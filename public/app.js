const socket = io();

const $ = id => document.getElementById(id);

let myId = null;
let currentState = null;

let categories = [
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


// ==================================================
// ERROR MESSAGE
// ==================================================

socket.on("errorMsg", message => {

  const error = $("error");

  if (error) {
    error.textContent = message;
  }

});


// ==================================================
// CHAT VISIBILITY
// ==================================================

function updateChatVisibility(state) {

  const lobbyChat = $("lobbyChat");

  if (!lobbyChat) {
    return;
  }


  // Chat is visible ONLY during:
  //
  // 1. Lobby
  // 2. Results
  //
  // It is hidden during:
  //
  // 3. Spinning
  // 4. Playing

  const chatAllowed =
    state.status === "lobby" ||
    state.status === "results";


  if (chatAllowed) {

    lobbyChat.classList.remove("hidden");

  } else {

    lobbyChat.classList.add("hidden");

  }

}


// ==================================================
// CLEAR CHAT
// ==================================================

function clearChat() {

  const chatMessages =
    $("chatMessages");

  if (!chatMessages) {
    return;
  }

  chatMessages.innerHTML = "";

}


// ==================================================
// RECEIVE CHAT MESSAGE
// ==================================================

socket.on("chatMessage", data => {

  const chatMessages =
    $("chatMessages");


  if (!chatMessages) {
    return;
  }


  const message =
    document.createElement("div");


  message.className =
    data.id === myId
      ? "chatMessage own"
      : "chatMessage";


  message.innerHTML = `
    <div class="chatName">
      ${esc(data.name)}
    </div>

    <div class="chatText">
      ${esc(data.message)}
    </div>
  `;


  chatMessages.appendChild(
    message
  );


  // Scroll to newest message
  chatMessages.scrollTop =
    chatMessages.scrollHeight;

});


// ==================================================
// SEND CHAT MESSAGE
// ==================================================

function sendChatMessage() {

  const input =
    $("chatInput");


  if (!input) {
    return;
  }


  const message =
    input.value.trim();


  if (!message) {
    return;
  }


  // Only send while chat
  // is currently allowed
  if (
    !currentState ||
    (
      currentState.status !== "lobby" &&
      currentState.status !== "results"
    )
  ) {
    return;
  }


  socket.emit(
    "chatMessage",
    {
      message:
        message.slice(0, 200)
    }
  );


  input.value = "";

  input.focus();

}


// ==================================================
// CHAT SEND BUTTON
// ==================================================

const sendChatBtn =
  $("sendChatBtn");


if (sendChatBtn) {

  sendChatBtn.addEventListener(
    "click",
    sendChatMessage
  );

}


// ==================================================
// CHAT ENTER KEY
// ==================================================

const chatInput =
  $("chatInput");


if (chatInput) {

  chatInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        sendChatMessage();

      }

    }
  );

}


// ==================================================
// GAME STATE
// ==================================================

socket.on("state", state => {

  currentState = state;


  // ==================================================
  // UPDATE CHAT VISIBILITY
  // ==================================================

  updateChatVisibility(
    state
  );


  // ==================================================
  // ROOM CODE
  // ==================================================

  const roomTag =
    $("roomTag");

  if (roomTag) {

    roomTag.textContent =
      state.code
        ? `Room ${state.code}`
        : "";

  }


  const code =
    $("code");

  if (code) {

    code.textContent =
      state.code || "";

  }


  const gameCode =
    $("gameCode");

  if (gameCode) {

    gameCode.textContent =
      state.code || "";

  }


  // ==================================================
  // SHOW PLAYERS
  // ==================================================

  const players =
    $("players");


  if (players) {

    players.innerHTML =
      state.players
        .map(
          (player, index) => {

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

          }
        )
        .join("");

  }


  // ==================================================
  // START BUTTON
  // ==================================================

  const startBtn =
    $("startBtn");


  if (startBtn) {

    startBtn.style.display =
      myId === state.hostId &&
      state.status === "lobby"
        ? "block"
        : "none";

  }


  // ==================================================
  // LOBBY
  // ==================================================

  if (
    state.status === "lobby"
  ) {

    show("lobby");

    hide("game");

  }


  // ==================================================
  // GAME
  // ==================================================

  else {

    hide("lobby");

    show("game");

    renderGame(state);

  }

});


// ==================================================
// RESULTS
// ==================================================

socket.on(
  "results",
  results => {

    renderResults(
      results
    );

  }
);


// ==================================================
// ESCAPE HTML
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

      return replacements[
        character
      ];

    }
  );

}


// ==================================================
// SHOW
// ==================================================

function show(id) {

  const element =
    $(id);


  if (element) {

    element.classList.remove(
      "hidden"
    );

  }

}


// ==================================================
// HIDE
// ==================================================

function hide(id) {

  const element =
    $(id);


  if (element) {

    element.classList.add(
      "hidden"
    );

  }

}


// ==================================================
// HOST GAME
// ==================================================

const hostBtn =
  $("hostBtn");


if (hostBtn) {

  hostBtn.onclick = () => {

    const name =
      $("name").value.trim() ||
      "Host";


    // Clear old chat
    clearChat();


    socket.emit(
      "host",
      {
        name: name
      }
    );


    hide("home");

  };

}


// ==================================================
// SHOW JOIN
// ==================================================

const showJoin =
  $("showJoin");


if (showJoin) {

  showJoin.onclick = () => {

    show("joinBox");

  };

}


// ==================================================
// JOIN GAME
// ==================================================

const joinBtn =
  $("joinBtn");


if (joinBtn) {

  joinBtn.onclick = () => {

    const name =
      $("name").value.trim() ||
      "Player";


    const code =
      $("joinCode").value.trim();


    if (!code) {

      const error =
        $("error");


      if (error) {

        error.textContent =
          "Please enter a room code.";

      }

      return;

    }


    socket.emit(
      "join",
      {
        code: code,
        name: name
      }
    );


    hide("home");

  };

}


// ==================================================
// START GAME
// ==================================================

const startBtn =
  $("startBtn");


if (startBtn) {

  startBtn.onclick = () => {

    socket.emit(
      "start"
    );

  };

}


// ==================================================
// NEXT ROUND
// ==================================================

const nextBtn =
  $("nextBtn");


if (nextBtn) {

  nextBtn.onclick = () => {

    socket.emit(
      "nextRound"
    );

  };

}


// ==================================================
// RENDER GAME
// ==================================================

function renderGame(state) {

  const letter =
    $("letter");


  if (letter) {

    letter.textContent =
      state.letter || "—";

  }


  const letterHint =
    $("letterHint");


  if (letterHint) {

    letterHint.textContent =
      state.letter || "";

  }


  // ==================================================
  // SPINNING
  // ==================================================

  if (
    state.status === "spinning"
  ) {

    $("statusText").textContent =
      "SPINNING…";


    show("spinner");

    hide("answers");

    hide("results");


    // Hide chat
    // while spinning
    hide("lobbyChat");


    animateSpin();

  }


  // ==================================================
  // PLAYING
  // ==================================================

  else if (
    state.status === "playing"
  ) {

    $("statusText").textContent =
      "GO!";


    hide("spinner");

    show("answers");

    hide("results");


    // Hide chat
    // during gameplay
    hide("lobbyChat");


    const fields =
      $("fields");


    if (
      fields &&
      fields.dataset.letter !==
      state.letter
    ) {

      fieldsBuilt = false;

    }


    buildFields(
      state.letter
    );


    const stopBtn =
      $("stopBtn");


    if (stopBtn) {

      stopBtn.disabled = false;

    }

  }


  // ==================================================
  // RESULTS
  // ==================================================

  else if (
    state.status === "results"
  ) {

    $("statusText").textContent =
      "ROUND RESULTS";


    hide("spinner");

    hide("answers");

    show("results");


    // SHOW CHAT
    // after round ends
    show("lobbyChat");

  }

}


// ==================================================
// BUILD ANSWER BOXES
// ==================================================

function buildFields(letter) {

  const fields =
    $("fields");


  if (!fields) {
    return;
  }


  if (
    fieldsBuilt &&
    fields.dataset.letter ===
      letter
  ) {

    return;

  }


  fieldsBuilt = true;


  fields.dataset.letter =
    letter;


  fields.innerHTML =
    categories
      .map(
        category => {

          return `
            <div class="field">

              <label>
                ${esc(category)}
              </label>

              <input
                class="answerInput"
                data-cat="${esc(category)}"
                autocomplete="off"
              >

            </div>
          `;

        }
      )
      .join("");

}


// ==================================================
// SPIN ANIMATION
// ==================================================

function animateSpin() {

  clearInterval(
    spinTimer
  );


  let index = 0;


  const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ";


  spinTimer =
    setInterval(
      () => {

        const spinLetter =
          $("spinLetter");


        if (spinLetter) {

          spinLetter.textContent =
            letters[
              index % 26
            ];

        }


        index++;

      },
      80
    );

}


// ==================================================
// GET ANSWERS
// ==================================================

function getAnswers() {

  const answers = {};


  document
    .querySelectorAll(
      ".answerInput"
    )
    .forEach(input => {

      answers[
        input.dataset.cat
      ] =
        input.value.trim();

    });


  return answers;

}


// ==================================================
// SYNC ANSWERS
// ==================================================

document.addEventListener(
  "input",
  event => {

    if (
      event.target.classList &&
      event.target.classList.contains(
        "answerInput"
      )
    ) {

      const answers =
        getAnswers();


      socket.emit(
        "syncAnswers",
        {
          answers: answers
        }
      );

    }

  }
);


// ==================================================
// STOP GAME
// ==================================================

const stopBtn =
  $("stopBtn");


if (stopBtn) {

  stopBtn.onclick = () => {

    const answers =
      getAnswers();


    stopBtn.disabled =
      true;


    socket.emit(
      "stop",
      {
        answers: answers
      }
    );

  };

}


// ==================================================
// RENDER RESULTS
// ==================================================

function renderResults(results) {

  let html = `
    <p class="winner">
      🛑 ${esc(results.stopper)}
      stopped the round first.
    </p>
  `;


  // ==================================================
  // PLAYER LOOKUP
  // ==================================================

  const playerMap =
    new Map(
      (
        currentState?.players ||
        []
      ).map(
        player => [
          player.id,
          player.name
        ]
      )
    );


  // ==================================================
  // SHOW EVERY PLAYER'S ANSWERS
  // ==================================================

  for (
    const id of Object.keys(
      results.answers || {}
    )
  ) {

    const answers =
      results.answers[id] ||
      {};


    const playerName =
      playerMap.get(id) ||
      "Player";


    html += `
      <div class="resultRow">

        <b>
          ${esc(playerName)}
        </b>

        <div>

          ${categories
            .map(
              category => {

                return `
                  <span class="answer">

                    <b>
                      ${esc(category)}:
                    </b>

                    ${esc(
                      answers[category] ||
                      "—"
                    )}

                  </span>
                `;

              }
            )
            .join("")}

        </div>

      </div>
    `;

  }


  const resultText =
    $("resultText");


  if (resultText) {

    resultText.innerHTML =
      html;

  }


  // ==================================================
  // NEXT ROUND BUTTON
  // ==================================================

  const nextRoundButton =
    $("nextBtn");


  if (nextRoundButton) {

    nextRoundButton.style.display =
      currentState &&
      myId === currentState.hostId
        ? "block"
        : "none";

  }


  // STOP BUTTON
  if (stopBtn) {

    stopBtn.disabled =
      false;

  }


  // ==================================================
  // SHOW CHAT AFTER ROUND
  // ==================================================

  show("lobbyChat");

}
