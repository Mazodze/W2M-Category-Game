const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));


// ==================================================
// GAME DATA
// ==================================================

const rooms = new Map();

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CATEGORIES = [
  "Cars",
  "Country",
  "Food",
  "Animal",
  "Name"
];


// ==================================================
// GENERATE ROOM CODE
// ==================================================

function generateRoomCode() {
  let roomCode;

  do {
    roomCode = String(
      Math.floor(10000 + Math.random() * 90000)
    );
  } while (rooms.has(roomCode));

  return roomCode;
}


// ==================================================
// GET ROOM STATE
// ==================================================

function getRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    letter: room.letter,
    categories: CATEGORIES,
    stopBy: room.stopBy,

    players: Array.from(room.players.values()).map(player => ({
      id: player.id,
      name: player.name,
      score: player.score
    }))
  };
}


// ==================================================
// BROADCAST ROOM STATE
// ==================================================

function broadcastRoom(room) {
  io.to(room.code).emit(
    "state",
    getRoomState(room)
  );
}


// ==================================================
// START ROUND
// ==================================================

function startRound(room) {
  room.status = "spinning";
  room.stopBy = null;
  room.letter = null;

  // Clear previous answers
  room.answers = {};

  broadcastRoom(room);


  // Wait 2.6 seconds before revealing letter
  setTimeout(() => {

    // Make sure room still exists
    // and is still spinning
    if (
      !rooms.has(room.code) ||
      room.status !== "spinning"
    ) {
      return;
    }


    // Pick random letter
    room.letter =
      LETTERS[
        Math.floor(
          Math.random() * LETTERS.length
        )
      ];


    room.status = "playing";

    broadcastRoom(room);

  }, 2600);
}


// ==================================================
// SOCKET CONNECTION
// ==================================================

io.on("connection", socket => {

  console.log(
    `Player connected: ${socket.id}`
  );


  // ==================================================
  // HOST GAME
  // ==================================================

  socket.on("host", ({ name }) => {

    const roomCode =
      generateRoomCode();


    const playerName =
      String(name || "Host")
        .trim()
        .slice(0, 18);


    const room = {

      code: roomCode,

      hostId: socket.id,

      status: "lobby",

      letter: null,

      stopBy: null,

      answers: {},

      players: new Map([
        [
          socket.id,
          {
            id: socket.id,
            name: playerName || "Host",
            score: 0
          }
        ]
      ])
    };


    rooms.set(
      roomCode,
      room
    );


    socket.join(roomCode);

    socket.data.room =
      roomCode;


    console.log(
      `Room created: ${roomCode}`
    );


    broadcastRoom(room);
  });


  // ==================================================
  // JOIN GAME
  // ==================================================

  socket.on("join", ({ code, name }) => {

    const roomCode =
      String(code || "")
        .trim();


    const room =
      rooms.get(roomCode);


    // Room doesn't exist
    if (!room) {

      return socket.emit(
        "errorMsg",
        "Room not found."
      );
    }


    // Game already started
    if (room.status !== "lobby") {

      return socket.emit(
        "errorMsg",
        "That game has already started."
      );
    }


    // Maximum 8 players
    if (room.players.size >= 8) {

      return socket.emit(
        "errorMsg",
        "Room is full."
      );
    }


    const playerName =
      String(name || "Player")
        .trim()
        .slice(0, 18);


    // Add player
    room.players.set(
      socket.id,
      {
        id: socket.id,
        name: playerName || "Player",
        score: 0
      }
    );


    socket.join(room.code);

    socket.data.room =
      room.code;


    console.log(
      `${playerName || "Player"} joined room ${room.code}`
    );


    broadcastRoom(room);
  });


  // ==================================================
  // CHAT
  // ==================================================

  socket.on(
    "chatMessage",
    ({ message }) => {

      const room =
        rooms.get(socket.data.room);


      if (!room) {
        return;
      }


      const player =
        room.players.get(socket.id);


      if (!player) {
        return;
      }


      const text =
        String(message || "")
          .trim();


      // Ignore empty messages
      if (!text) {
        return;
      }


      // Limit message length
      const safeMessage =
        text.slice(0, 200);


      // Send ONLY to players
      // inside this room
      io.to(room.code).emit(
        "chatMessage",
        {
          id: socket.id,
          name: player.name,
          message: safeMessage
        }
      );
    }
  );


  // ==================================================
  // START GAME
  // ==================================================

  socket.on("start", () => {

    const room =
      rooms.get(socket.data.room);


    // Only host can start
    // Need at least 2 players
    if (
      !room ||
      room.hostId !== socket.id ||
      room.players.size < 2
    ) {
      return;
    }


    console.log(
      `Game started in room ${room.code}`
    );


    startRound(room);
  });


  // ==================================================
  // SYNC ANSWERS
  // ==================================================

  socket.on(
    "syncAnswers",
    ({ answers }) => {

      const room =
        rooms.get(socket.data.room);


      // Only accept answers
      // while the round is active
      if (
        !room ||
        room.status !== "playing" ||
        room.stopBy
      ) {
        return;
      }


      room.answers[socket.id] =
        answers || {};
    }
  );


  // ==================================================
  // STOP GAME
  // ==================================================

  socket.on(
    "stop",
    ({ answers }) => {

      const room =
        rooms.get(socket.data.room);


      // Ignore invalid STOP requests
      if (
        !room ||
        room.status !== "playing" ||
        room.stopBy
      ) {
        return;
      }


      // Save latest answers
      room.answers[socket.id] =
        answers || {};


      // Stop the round
      room.stopBy =
        socket.id;

      room.status =
        "results";


      broadcastRoom(room);


      // Send results to everyone
      // in this room
      io.to(room.code).emit(
        "results",
        {
          letter: room.letter,

          stopper:
            room.players.get(socket.id)?.name ||
            "Player",

          answers:
            room.answers
        }
      );


      console.log(
        `Round stopped in room ${room.code}`
      );
    }
  );


  // ==================================================
  // NEXT ROUND
  // ==================================================

  socket.on("nextRound", () => {

    const room =
      rooms.get(socket.data.room);


    // Only host can start
    // the next round
    if (
      !room ||
      room.hostId !== socket.id
    ) {
      return;
    }


    startRound(room);
  });


  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on("disconnect", () => {

    const roomCode =
      socket.data.room;


    const room =
      rooms.get(roomCode);


    if (!room) {
      return;
    }


    const player =
      room.players.get(socket.id);


    console.log(
      `Player disconnected: ${
        player?.name || socket.id
      }`
    );


    // Remove player
    room.players.delete(
      socket.id
    );


    // Remove their answers
    delete room.answers[
      socket.id
    ];


    // ==================================================
    // HOST LEFT
    // ==================================================

    if (
      room.hostId === socket.id
    ) {

      const firstPlayer =
        room.players
          .values()
          .next()
          .value;


      if (firstPlayer) {

        // Give host role
        // to another player
        room.hostId =
          firstPlayer.id;

      } else {

        // No players left
        rooms.delete(roomCode);

        console.log(
          `Room deleted: ${roomCode}`
        );

        return;
      }
    }


    broadcastRoom(room);
  });

});


// ==================================================
// START SERVER
// ==================================================

const PORT =
  process.env.PORT || 3000;


server.listen(
  PORT,
  () => {

    console.log(
      `Game running on port ${PORT}`
    );

  }
);