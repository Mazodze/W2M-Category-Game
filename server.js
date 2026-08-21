const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 5e6
});

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
      Math.floor(
        10000 + Math.random() * 90000
      )
    );
  } while (rooms.has(roomCode));

  return roomCode;
}

// ==================================================
// SHUFFLE LETTERS
// ==================================================

function shuffleLetters() {
  const shuffled = [...LETTERS];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled;
}

// ==================================================
// GET NEXT LETTER
// ==================================================

function getNextLetter(room) {
  if (
    !room.letterPool ||
    room.letterPool.length === 0
  ) {
    room.letterPool = shuffleLetters();

    console.log(
      `Room ${room.code}: New 26-letter cycle started.`
    );
  }

  return room.letterPool.shift();
}

// ==================================================
// GET SCOREBOARD
// ==================================================

function getScoreboard(room) {
  return Array.from(room.players.values())
    .map(player => ({
      id: player.id,
      name: player.name,
      score: Number(player.score) || 0
    }))
    .sort((a, b) => b.score - a.score);
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

    roundScores: room.roundScores || {},

    scoreboard: getScoreboard(room),

    chatEnabled:
      room.status === "lobby" ||
      room.status === "results",

    players: Array.from(
      room.players.values()
    ).map(player => ({
      id: player.id,
      name: player.name,
      score: Number(player.score) || 0
    }))
  };
}

// ==================================================
// BROADCAST ROOM STATE
// ==================================================

function broadcastRoom(room) {
  io
    .to(room.code)
    .emit(
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
  room.answers = {};
  room.roundScores = {};

  broadcastRoom(room);

  setTimeout(() => {
    if (
      !rooms.has(room.code) ||
      room.status !== "spinning"
    ) {
      return;
    }

    room.letter = getNextLetter(room);

    console.log(
      `Room ${room.code}: Letter = ${room.letter}`
    );

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
    const roomCode = generateRoomCode();

    const playerName = String(
      name || "Host"
    )
      .trim()
      .slice(0, 18);

    const room = {
      code: roomCode,

      hostId: socket.id,

      status: "lobby",

      letter: null,

      stopBy: null,

      answers: {},

      roundScores: {},

      letterPool: [],

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

    socket.data.room = roomCode;

    console.log(
      `Room created: ${roomCode}`
    );

    broadcastRoom(room);
  });

  // ==================================================
  // JOIN GAME
  // ==================================================

  socket.on("join", ({ code, name }) => {
    const roomCode = String(
      code || ""
    ).trim();

    const room = rooms.get(roomCode);

    if (!room) {
      return socket.emit(
        "errorMsg",
        "Room not found."
      );
    }

    if (room.status !== "lobby") {
      return socket.emit(
        "errorMsg",
        "That game has already started."
      );
    }

    if (room.players.size >= 8) {
      return socket.emit(
        "errorMsg",
        "Room is full."
      );
    }

    const playerName = String(
      name || "Player"
    )
      .trim()
      .slice(0, 18);

    room.players.set(
      socket.id,
      {
        id: socket.id,
        name: playerName || "Player",
        score: 0
      }
    );

    socket.join(room.code);

    socket.data.room = room.code;

    console.log(
      `${playerName || "Player"} joined room ${room.code}`
    );

    broadcastRoom(room);
  });

  // ==================================================
  // TEXT CHAT
  // ==================================================

  socket.on(
    "chatMessage",
    ({ message }) => {
      const room = rooms.get(
        socket.data.room
      );

      if (!room) {
        return;
      }

      const player = room.players.get(
        socket.id
      );

      if (!player) {
        return;
      }

      if (
        room.status !== "lobby" &&
        room.status !== "results"
      ) {
        return;
      }

      const text = String(
        message || ""
      ).trim();

      if (!text) {
        return;
      }

      const safeMessage =
        text.slice(0, 200);

      io
        .to(room.code)
        .emit(
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
  // VOICE NOTE
  // ==================================================

  socket.on(
    "voiceMessage",
    ({
      audio,
      mimeType,
      duration
    }) => {
      const room = rooms.get(
        socket.data.room
      );

      if (!room) {
        return;
      }

      const player = room.players.get(
        socket.id
      );

      if (!player) {
        return;
      }

      if (
        room.status !== "lobby" &&
        room.status !== "results"
      ) {
        return;
      }

      const safeDuration =
        Number(duration) || 0;

      if (
        safeDuration <= 0 ||
        safeDuration > 30000
      ) {
        return socket.emit(
          "voiceError",
          "Voice note must be between 1 and 30 seconds."
        );
      }

      if (!audio) {
        return socket.emit(
          "voiceError",
          "No audio recording received."
        );
      }

      let audioBuffer;

      if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
      } else if (
        audio instanceof Uint8Array
      ) {
        audioBuffer = Buffer.from(audio);
      } else if (
        audio instanceof ArrayBuffer
      ) {
        audioBuffer = Buffer.from(audio);
      } else {
        return socket.emit(
          "voiceError",
          "Invalid audio format."
        );
      }

      if (
        audioBuffer.length >
        5 * 1024 * 1024
      ) {
        return socket.emit(
          "voiceError",
          "Voice note is too large."
        );
      }

      console.log(
        `Voice note from ${player.name}: ${audioBuffer.length} bytes`
      );

      io
        .to(room.code)
        .emit(
          "voiceMessage",
          {
            id: socket.id,
            name: player.name,
            audio: audioBuffer,
            mimeType:
              mimeType ||
              "audio/webm",
            duration: safeDuration
          }
        );
    }
  );

  // ==================================================
  // START GAME
  // ==================================================

  socket.on("start", () => {
    const room = rooms.get(
      socket.data.room
    );

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
      const room = rooms.get(
        socket.data.room
      );

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
      const room = rooms.get(
        socket.data.room
      );

      if (
        !room ||
        room.status !== "playing" ||
        room.stopBy
      ) {
        return;
      }

      room.answers[socket.id] =
        answers || {};

      room.stopBy =
        socket.id;

      room.status =
        "results";

      room.roundScores = {};

      broadcastRoom(room);

      io
        .to(room.code)
        .emit(
          "results",
          {
            letter:
              room.letter,

            stopper:
              room.players.get(
                socket.id
              )?.name ||
              "Player",

            answers:
              room.answers,

            scoreboard:
              getScoreboard(room),

            roundScores:
              room.roundScores
          }
        );

      console.log(
        `Round stopped in room ${room.code}`
      );
    }
  );

  // ==================================================
  // HOST SUBMITS ROUND SCORES
  // ==================================================

  socket.on(
    "submitRoundScores",
    ({ scores }) => {
      const room = rooms.get(
        socket.data.room
      );

      if (!room) {
        return;
      }

      // ONLY HOST
      if (
        room.hostId !== socket.id
      ) {
        return socket.emit(
          "errorMsg",
          "Only the host can enter round scores."
        );
      }

      // ONLY AFTER ROUND
      if (
        room.status !== "results"
      ) {
        return socket.emit(
          "errorMsg",
          "Scores can only be entered at the end of a round."
        );
      }

      // PREVENT DUPLICATE SUBMISSION
      if (
        room.roundScores &&
        Object.keys(
          room.roundScores
        ).length > 0
      ) {
        return socket.emit(
          "errorMsg",
          "Scores for this round have already been submitted."
        );
      }

      // VALIDATE SCORES
      if (
        !scores ||
        typeof scores !== "object" ||
        Array.isArray(scores)
      ) {
        return socket.emit(
          "errorMsg",
          "Invalid scoreboard data."
        );
      }

      const safeScores = {};

      // ==================================================
      // PROCESS EACH PLAYER
      // ==================================================

      for (
        const player of room.players.values()
      ) {
        const playerScores =
          scores[player.id];

        const categoryScores = {};

        let roundTotal = 0;

        // ==================================================
        // PROCESS EACH CATEGORY
        // ==================================================

        for (
          const category of CATEGORIES
        ) {
          let value = 0;

          if (
            playerScores &&
            typeof playerScores === "object" &&
            !Array.isArray(playerScores)
          ) {
            value =
              playerScores[category];
          }

          if (
            value === undefined ||
            value === null ||
            value === ""
          ) {
            value = 0;
          }

          value =
            Number(value);

          if (
            !Number.isFinite(value)
          ) {
            value = 0;
          }

          value =
            Math.max(
              0,
              Math.min(
                10,
                Math.round(value)
              )
            );

          categoryScores[category] =
            value;

          roundTotal += value;
        }

        // SAVE CATEGORY SCORES
        safeScores[player.id] =
          categoryScores;

        // ADD ROUND TOTAL
        player.score =
          (
            Number(
              player.score
            ) || 0
          ) +
          roundTotal;

        console.log(
          `Score submitted: ${player.name} = ${roundTotal}`,
          categoryScores
        );
      }

      // ==================================================
      // SAVE ROUND SCORES
      // ==================================================

      room.roundScores =
        safeScores;

      // ==================================================
      // BROADCAST STATE
      // ==================================================

      broadcastRoom(room);

      // ==================================================
      // BROADCAST SCOREBOARD
      // ==================================================

      io
        .to(room.code)
        .emit(
          "scoreboardUpdated",
          {
            roundScores:
              room.roundScores,

            players:
              Array.from(
                room.players.values()
              ).map(player => ({
                id: player.id,
                name: player.name,
                score:
                  Number(
                    player.score
                  ) || 0
              })),

            scoreboard:
              getScoreboard(room)
          }
        );

      console.log(
        `Host submitted scores for room ${room.code}:`
      );

      console.log(
        JSON.stringify(
          room.roundScores,
          null,
          2
        )
      );

      console.log(
        "Updated scoreboard:",
        getScoreboard(room)
      );
    }
  );

  // ==================================================
  // NEXT ROUND
  // ==================================================

  socket.on(
    "nextRound",
    () => {
      const room = rooms.get(
        socket.data.room
      );

      if (
        !room ||
        room.hostId !== socket.id ||
        room.status !== "results"
      ) {
        return;
      }

      console.log(
        `Starting next round in room ${room.code}`
      );

      startRound(room);
    }
  );

  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on(
    "disconnect",
    () => {
      const roomCode =
        socket.data.room;

      const room =
        rooms.get(roomCode);

      if (!room) {
        return;
      }

      const player =
        room.players.get(
          socket.id
        );

      console.log(
        `Player disconnected: ${
          player?.name ||
          socket.id
        }`
      );

      room.players.delete(
        socket.id
      );

      delete room.answers[
        socket.id
      ];

      delete room.roundScores[
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
          room.hostId =
            firstPlayer.id;
        } else {
          rooms.delete(
            roomCode
          );

          console.log(
            `Room deleted: ${roomCode}`
          );

          return;
        }
      }

      broadcastRoom(room);
    }
  );
});

// ==================================================
// START SERVER
// ==================================================

const PORT =
  process.env.PORT ||
  3000;

server.listen(
  PORT,
  () => {
    console.log(
      `Game running on port ${PORT}`
    );
  }
);
