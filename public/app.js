const socket = io();

const $ = id => document.getElementById(id);

let myId = null;
let currentState = null;

const categories = [
  "Cars",
  "Country",
  "Food",
  "Animal",
  "Name"
];

let fieldsBuilt = false;
let spinTimer;


// ==================================================
// CONNECTION
// ==================================================

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("errorMsg", message => {
  const error = $("error");

  if (error) {
    error.textContent = message;
  }
});


// ==================================================
// LOBBY CHAT
// ==================================================

// Receive chat messages from the server
socket.on("chatMessage", data => {

  const chatMessages = $("chatMessages");

  if (!chatMessages) {
    return;
  }

  const messageElement =
    document.createElement("div");

  messageElement.className =
    data.id === myId
      ? "chatMessage own"
      : "chatMessage";

  messageElement.innerHTML = `
    <div class="chatName">
      ${esc(data.name)}
    </div>

    <div class="chatText">
      ${esc(data.message)}
    </div>
  `;

  chatMessages.appendChild(messageElement);

  // Scroll to newest message
  chatMessages.scrollTop =
    chatMessages.scrollHeight;
});


// ==================================================
// SEND CHAT MESSAGE
// ==================================================

function sendChatMessage() {

  const input = $("chatInput");

  if (!input) {
    return;
  }

  const message =
    input.value.trim();

  if (!message) {
    return;
  }

  socket.emit("chatMessage", {
    message: message.slice(0, 200)
  });

  input.value = "";

  input.focus();
}


// Send button
document.addEventListener("click", event => {

  if (event.target.id === "sendChatBtn") {
    sendChatMessage();
  }

});


// Press ENTER to send
document.addEventListener("keydown", event => {

  if (
    event.target.id === "chatInput" &&
    event.key === "Enter"
  ) {

    event.preventDefault();

    sendChatMessage();
  }

});


// ==================================================
// GAME STATE
// ==================================================

socket.on("state", state => {

  currentState = state;


  // ----------------------------------------------
  // ROOM CODE
  // ----------------------------------------------

  const roomTag = $("roomTag");
  const code = $("code");
  const gameCode = $("gameCode");

  if (roomTag) {
    roomTag.textContent =
      state.code
        ? `Room ${state.code}`
        : "";
  }

  if (code) {
    code.textContent =
      state.code || "";
  }

  if (gameCode) {
    gameCode.textContent =
      state.code || "";
  }


  // ----------------------------------------------
  // PLAYERS
  // ----------------------------------------------

  const playersElement = $("players");

  if (playersElement) {

    playersElement.innerHTML =
      state.players
        .map((player, index) => {

          const crown =
            index === 0 &&
            player.id === state.hostId
              ? "👑 "
              : "";

          return `
            <div class="player">

              <span>
                ${crown}${esc(player.name)}
              </span>

              <span>
                ${player.score}
              </span>

            </div>
          `;
        })
        .join("");
  }


  // ----------------------------------------------
  // HOST START BUTTON
  // ----------------------------------------------

  const startBtn = $("startBtn");

  if (startBtn) {

    startBtn.style.display =
      myId === state.hostId &&
      state.status === "lobby"
        ? "block"
        : "none";
  }


  // ----------------------------------------------
  // LOBBY / GAME
  // ----------------------------------------------

  if (state.status === "lobby") {

    show("lobby");
    hide("game");

  } else {

    hide("lobby");
    show("game");

    renderGame(state);
  }

});


// ==================================================
// RESULTS
// ==================================================

socket.on("results", results => {
  renderResults(results);
});


// ==================================================
// HELPER FUNCTIONS
// ==================================================

function esc(value) {

  return String(value).replace(
    /[&<>"']/g,
    character => {

      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return replacements[character];
    }
  );
}


function show(id) {

  const element = $(id);

  if (element) {
    element.classList.remove("hidden");
  }
}


function hide(id) {

  const element = $(id);

  if (element) {
    element.classList.add("hidden");
  }
}


// ==================================================
// HOST GAME
// ==================================================

const hostBtn = $("hostBtn");

if (hostBtn) {

  hostBtn.onclick = () => {

    const nameInput = $("name");

    const name =
      nameInput?.value.trim() || "Host";

    socket.emit("host", {
      name: name
    });

    hide("home");
  };
}


// ==================================================
// SHOW JOIN
// ==================================================

const showJoin = $("showJoin");

if (showJoin) {

  showJoin.onclick = () => {
    show("joinBox");
  };
}


// ==================================================
// JOIN GAME
// ==================================================

const joinBtn = $("joinBtn");

if (joinBtn) {

  joinBtn.onclick = () => {

    const nameInput = $("name");
    const codeInput = $("joinCode");

    const name =
      nameInput?.value.trim() || "Player";

    const code =
      codeInput?.value.trim();

    if (!code) {
      const error = $("error");

      if (error) {
        error.textContent =
          "Please enter the room code.";
      }

      return;
    }

    socket.emit("join", {
      code: code,
      name: name
    });

    hide("home");
  };
}


// ==================================================
// START GAME
// ==================================================

const startBtn = $("startBtn");

if (startBtn) {

  startBtn.onclick = () => {
    socket.emit("start");
  };
}


// ==================================================
// NEXT ROUND
// ==================================================

const nextBtn = $("nextBtn");

if (nextBtn) {

  nextBtn.onclick = () => {
    socket.emit("nextRound");
  };
}


// ==================================================
// RENDER GAME
// ==================================================

function renderGame(state) {

  const letter = $("letter");
  const letterHint = $("letterHint");

  if (letter) {
    letter.textContent =
      state.letter || "—";
  }

  if (letterHint) {
    letterHint.textContent =
      state.letter || "";
  }


  // ----------------------------------------------
  // SPINNING
  // ----------------------------------------------

  if (state.status === "spinning") {

    $("statusText").textContent =
      "SPINNING…";

    show("spinner");
    hide("answers");
    hide("results");

    animateSpin();
  }


  // ----------------------------------------------
  // PLAYING
  // ----------------------------------------------

  else if (state.status === "playing") {

    $("statusText").textContent =
      "GO!";

    hide("spinner");
    show("answers");
    hide("results");


    const fields = $("fields");

    if (
      fields &&
      fields.dataset.letter !== state.letter
    ) {

      fieldsBuilt = false;
    }

    buildFields(state.letter);


    const stopBtn = $("stopBtn");

    if (stopBtn) {
      stopBtn.disabled = false;
    }
  }


  // ----------------------------------------------
  // RESULTS
  // ----------------------------------------------

  else if (state.status === "results") {

    $("statusText").textContent =
      "ROUND RESULTS";

    hide("spinner");
    hide("answers");
    show("results");
  }

}


// ==================================================
// BUILD ANSWER BOXES
// ==================================================

function buildFields(letter) {

  const fields = $("fields");

  if (!fields) {
    return;
  }


  if (
    fieldsBuilt &&
    fields.dataset.letter === letter
  ) {

    return;
  }


  fieldsBuilt = true;

  fields.dataset.letter = letter;


  fields.innerHTML =
    categories
      .map(category => {

        return `
          <div class="field">

            <label>
              ${category}
            </label>

            <input
              class="answerInput"
              data-cat="${category}"
              autocomplete="off"
            >

          </div>
        `;

      })
      .join("");
}


// ==================================================
// SPIN ANIMATION
// ==================================================

function animateSpin() {

  clearInterval(spinTimer);

  let index = 0;

  const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ";


  spinTimer = setInterval(() => {

    const spinLetter = $("spinLetter");

    if (spinLetter) {

      spinLetter.textContent =
        letters[index % 26];
    }

    index++;

  }, 80);
}


// ==================================================
// GET ANSWERS
// ==================================================

function getAnswers() {

  const answers = {};

  document
    .querySelectorAll(".answerInput")
    .forEach(input => {

      answers[input.dataset.cat] =
        input.value.trim();

    });

  return answers;
}


// ==================================================
// SYNC ANSWERS
// ==================================================
//
// Every player sends their answers to the server
// while typing.
//
// The server stores each player's answers separately.
// When somebody presses STOP, everyone receives
// everyone's answers.
//

document.addEventListener(
  "input",
  event => {

    if (
      event.target.classList &&
      event.target.classList.contains(
        "answerInput"
      )
    ) {

      socket.emit("syncAnswers", {
        answers: getAnswers()
      });
    }

  }
);


// ==================================================
// STOP GAME
// ==================================================

const stopBtn = $("stopBtn");

if (stopBtn) {

  stopBtn.onclick = () => {

    const answers =
      getAnswers();

    stopBtn.disabled = true;

    socket.emit("stop", {
      answers: answers
    });

  };
}


// ==================================================
// SHOW RESULTS
// ==================================================

function renderResults(results) {

  let html = `
    <p class="winner">
      🛑 ${esc(results.stopper)}
      stopped the round first.
    </p>
  `;


  // ----------------------------------------------
  // PLAYER LOOKUP
  // ----------------------------------------------

  const playerMap =
    new Map(
      (currentState?.players || [])
        .map(player => [
          player.id,
          player.name
        ])
    );


  // ----------------------------------------------
  // EVERY PLAYER'S ANSWERS
  // ----------------------------------------------

  for (
    const id of Object.keys(
      results.answers || {}
    )
  ) {

    const answers =
      results.answers[id] || {};

    const playerName =
      playerMap.get(id) || "Player";


    html += `
      <div class="resultRow">

        <b>
          ${esc(playerName)}
        </b>

        <div>

          ${categories
            .map(category => {

              return `
                <span class="answer">

                  <b>${category}:</b>

                  ${esc(
                    answers[category] || "—"
                  )}

                </span>
              `;

            })
            .join("")}

        </div>

      </div>
    `;
  }


  const resultText = $("resultText");

  if (resultText) {
    resultText.innerHTML = html;
  }


  // ----------------------------------------------
  // NEXT ROUND
  // ----------------------------------------------

  const nextRoundBtn = $("nextBtn");

  if (nextRoundBtn) {

    nextRoundBtn.style.display =
      myId === currentState?.hostId
        ? "block"
        : "none";
  }


  if (stopBtn) {
    stopBtn.disabled = false;
  }

}