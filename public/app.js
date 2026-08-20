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
// VOICE RECORDING VARIABLES
// ==================================================

let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isRecording = false;
let recordingStartTime = 0;


// ==================================================
// CONNECTION
// ==================================================

socket.on("connect", () => {

  myId = socket.id;

  console.log(
    "Connected:",
    myId
  );

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
// VOICE ERROR
// ==================================================

socket.on("voiceError", message => {

  console.error(
    "Voice error:",
    message
  );

  alert(message);

  updateVoiceUI(false);

});


// ==================================================
// CHAT VISIBILITY
// ==================================================

function updateChatVisibility(state) {

  const lobbyChat = $("lobbyChat");

  if (!lobbyChat) {
    return;
  }

  const chatAllowed =
    state.status === "lobby" ||
    state.status === "results";


  if (chatAllowed) {

    lobbyChat.classList.remove(
      "hidden"
    );

  } else {

    lobbyChat.classList.add(
      "hidden"
    );

    if (isRecording) {

      stopVoiceRecording();

    }

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
// RECEIVE NORMAL CHAT MESSAGE
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


  chatMessages.scrollTop =
    chatMessages.scrollHeight;

});


// ==================================================
// RECEIVE VOICE NOTE
// ==================================================

socket.on("voiceMessage", data => {

  const chatMessages =
    $("chatMessages");

  if (!chatMessages) {
    return;
  }


  console.log(
    "Voice note received:",
    data
  );


  // ==================================================
  // CONVERT RECEIVED AUDIO TO BLOB URL
  // ==================================================

  let audioBlob;


  try {

    if (
      data.audio instanceof ArrayBuffer
    ) {

      audioBlob =
        new Blob(
          [data.audio],
          {
            type:
              data.mimeType ||
              "audio/webm"
          }
        );

    }

    else if (
      data.audio instanceof Uint8Array
    ) {

      audioBlob =
        new Blob(
          [data.audio],
          {
            type:
              data.mimeType ||
              "audio/webm"
          }
        );

    }

    else if (
      data.audio &&
      data.audio.type === "Buffer" &&
      Array.isArray(data.audio.data)
    ) {

      audioBlob =
        new Blob(
          [
            new Uint8Array(
              data.audio.data
            )
          ],
          {
            type:
              data.mimeType ||
              "audio/webm"
          }
        );

    }

    else {

      console.error(
        "Unknown audio format:",
        data.audio
      );

      return;

    }

  }

  catch (error) {

    console.error(
      "Could not create audio blob:",
      error
    );

    return;

  }


  const audioUrl =
    URL.createObjectURL(
      audioBlob
    );


  // ==================================================
  // CREATE CHAT MESSAGE
  // ==================================================

  const message =
    document.createElement("div");


  message.className =
    data.id === myId
      ? "chatMessage own"
      : "chatMessage";


  const name =
    document.createElement("div");

  name.className =
    "chatName";

  name.textContent =
    data.name;


  const voiceContainer =
    document.createElement("div");

  voiceContainer.className =
    "voiceMessage";


  const icon =
    document.createElement("span");

  icon.className =
    "voiceIcon";

  icon.textContent =
    "🎙️";


  const audio =
    document.createElement("audio");

  audio.controls = true;

  audio.preload =
    "metadata";

  audio.src =
    audioUrl;


  // Duration display
  if (
    data.duration &&
    Number(data.duration) > 0
  ) {

    const duration =
      document.createElement("span");

    duration.className =
      "voiceDuration";

    duration.textContent =
      formatDuration(
        Number(data.duration)
      );

    voiceContainer.appendChild(
      duration
    );

  }


  voiceContainer.appendChild(
    icon
  );

  voiceContainer.appendChild(
    audio
  );


  message.appendChild(
    name
  );

  message.appendChild(
    voiceContainer
  );


  chatMessages.appendChild(
    message
  );


  chatMessages.scrollTop =
    chatMessages.scrollHeight;

});


// ==================================================
// FORMAT VOICE DURATION
// ==================================================

function formatDuration(milliseconds) {

  const totalSeconds =
    Math.floor(
      milliseconds / 1000
    );


  const minutes =
    Math.floor(
      totalSeconds / 60
    );


  const seconds =
    totalSeconds % 60;


  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );

}


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
// VOICE BUTTON
// ==================================================

const voiceBtn =
  $("voiceBtn");


if (voiceBtn) {

  voiceBtn.addEventListener(
    "click",
    () => {

      startVoiceRecording();

    }
  );

}


// ==================================================
// STOP VOICE BUTTON
// ==================================================

const stopVoiceBtn =
  $("stopVoiceBtn");


if (stopVoiceBtn) {

  stopVoiceBtn.addEventListener(
    "click",
    () => {

      stopVoiceRecording();

    }
  );

}


// ==================================================
// START VOICE RECORDING
// ==================================================

async function startVoiceRecording() {

  console.log(
    "Starting voice recording..."
  );


  // ==================================================
  // CHECK GAME STATE
  // ==================================================

  if (
    !currentState ||
    (
      currentState.status !== "lobby" &&
      currentState.status !== "results"
    )
  ) {

    alert(
      "Voice notes are only available in the lobby and results."
    );

    return;

  }


  // ==================================================
  // PREVENT DOUBLE RECORDING
  // ==================================================

  if (isRecording) {

    return;

  }


  // ==================================================
  // CHECK MICROPHONE SUPPORT
  // ==================================================

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    alert(
      "Your browser does not support microphone access."
    );

    return;

  }


  if (
    !window.MediaRecorder
  ) {

    alert(
      "Your browser does not support voice recording."
    );

    return;

  }


  try {

    // ==================================================
    // REQUEST MICROPHONE
    // ==================================================

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });


    console.log(
      "Microphone permission granted."
    );


    audioChunks = [];


    // ==================================================
    // SELECT SUPPORTED AUDIO FORMAT
    // ==================================================

    let mimeType =
      "";


    const formats = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4"
    ];


    for (
      const format of formats
    ) {

      if (
        MediaRecorder.isTypeSupported(
          format
        )
      ) {

        mimeType =
          format;

        break;

      }

    }


    console.log(
      "Selected audio format:",
      mimeType || "browser default"
    );


    // ==================================================
    // CREATE MEDIA RECORDER
    // ==================================================

    if (mimeType) {

      mediaRecorder =
        new MediaRecorder(
          stream,
          {
            mimeType:
              mimeType
          }
        );

    } else {

      mediaRecorder =
        new MediaRecorder(
          stream
        );

    }


    // ==================================================
    // AUDIO DATA
    // ==================================================

    mediaRecorder.ondataavailable =
      event => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          audioChunks.push(
            event.data
          );

        }

      };


    // ==================================================
    // RECORDING STARTED
    // ==================================================

    mediaRecorder.onstart =
      () => {

        console.log(
          "Recording started."
        );

      };


    // ==================================================
    // RECORDING STOPPED
    // ==================================================

    mediaRecorder.onstop =
      async () => {

        console.log(
          "Recording stopped."
        );


        // Stop microphone
        stream
          .getTracks()
          .forEach(
            track => track.stop()
          );


        clearInterval(
          recordingTimer
        );

        recordingTimer =
          null;


        isRecording =
          false;


        updateVoiceUI(
          false
        );


        // ==================================================
        // CHECK AUDIO
        // ==================================================

        if (
          audioChunks.length === 0
        ) {

          console.warn(
            "No audio data recorded."
          );

          return;

        }


        // ==================================================
        // CREATE AUDIO BLOB
        // ==================================================

        const finalMimeType =
          mediaRecorder.mimeType ||
          mimeType ||
          "audio/webm";


        const audioBlob =
          new Blob(
            audioChunks,
            {
              type:
                finalMimeType
            }
          );


        console.log(
          "Audio size:",
          audioBlob.size,
          "bytes"
        );


        console.log(
          "Audio type:",
          audioBlob.type
        );


        // ==================================================
        // SEND AUDIO
        // ==================================================

        await sendVoiceMessage(
          audioBlob,
          finalMimeType
        );

      };


    // ==================================================
    // HANDLE RECORDER ERROR
    // ==================================================

    mediaRecorder.onerror =
      event => {

        console.error(
          "MediaRecorder error:",
          event.error
        );

        stream
          .getTracks()
          .forEach(
            track => track.stop()
          );

        isRecording =
          false;

        updateVoiceUI(
          false
        );

      };


    // ==================================================
    // START RECORDING
    // ==================================================

    mediaRecorder.start(
      250
    );


    isRecording =
      true;


    recordingSeconds =
      0;


    recordingStartTime =
      Date.now();


    updateVoiceTimer();


    updateVoiceUI(
      true
    );


    // ==================================================
    // TIMER
    // ==================================================

    recordingTimer =
      setInterval(
        () => {

          recordingSeconds =
            Math.floor(
              (
                Date.now() -
                recordingStartTime
              ) / 1000
            );


          updateVoiceTimer();


          // Server accepts max 30 seconds
          if (
            recordingSeconds >= 30
          ) {

            stopVoiceRecording();

          }

        },
        250
      );

  }

  catch (error) {

    console.error(
      "Microphone error:",
      error
    );


    if (
      error.name ===
      "NotAllowedError"
    ) {

      alert(
        "Microphone permission was denied. Please allow microphone access."
      );

    }

    else if (
      error.name ===
      "NotFoundError"
    ) {

      alert(
        "No microphone was found. Check that your microphone is connected."
      );

    }

    else if (
      error.name ===
      "NotReadableError"
    ) {

      alert(
        "Your microphone is already being used by another application."
      );

    }

    else if (
      error.name ===
      "SecurityError"
    ) {

      alert(
        "The browser blocked microphone access. Run the game through localhost in VS Code."
      );

    }

    else {

      alert(
        "Could not access your microphone: " +
        error.message
      );

    }

  }

}


// ==================================================
// STOP VOICE RECORDING
// ==================================================

function stopVoiceRecording() {

  console.log(
    "Stopping voice recording..."
  );


  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {

    mediaRecorder.stop();

  }


  clearInterval(
    recordingTimer
  );

  recordingTimer =
    null;

}


// ==================================================
// UPDATE VOICE UI
// ==================================================

function updateVoiceUI(
  recording
) {

  const voiceBtn =
    $("voiceBtn");


  const voiceStatus =
    $("voiceStatus");


  const stopVoiceBtn =
    $("stopVoiceBtn");


  if (recording) {

    if (voiceBtn) {

      voiceBtn.disabled =
        true;

      voiceBtn.textContent =
        "🔴";

    }


    if (voiceStatus) {

      voiceStatus.classList.remove(
        "hidden"
      );

    }


    if (stopVoiceBtn) {

      stopVoiceBtn.disabled =
        false;

    }

  }

  else {

    if (voiceBtn) {

      voiceBtn.disabled =
        false;

      voiceBtn.textContent =
        "🎙️";

    }


    if (voiceStatus) {

      voiceStatus.classList.add(
        "hidden"
      );

    }


    if (stopVoiceBtn) {

      stopVoiceBtn.disabled =
        false;

    }


    recordingSeconds =
      0;

    updateVoiceTimer();

  }

}


// ==================================================
// VOICE TIMER
// ==================================================

function updateVoiceTimer() {

  const timer =
    $("voiceTimer");


  if (!timer) {
    return;
  }


  const minutes =
    Math.floor(
      recordingSeconds / 60
    );


  const seconds =
    recordingSeconds % 60;


  timer.textContent =
    String(minutes).padStart(
      2,
      "0"
    ) +
    ":" +
    String(seconds).padStart(
      2,
      "0"
    );

}


// ==================================================
// SEND VOICE MESSAGE
// ==================================================

async function sendVoiceMessage(
  audioBlob,
  mimeType
) {

  console.log(
    "Preparing voice note..."
  );


  // ==================================================
  // CHECK STATE
  // ==================================================

  if (
    !currentState ||
    (
      currentState.status !== "lobby" &&
      currentState.status !== "results"
    )
  ) {

    console.warn(
      "Voice note blocked because chat is disabled."
    );

    return;

  }


  // ==================================================
  // CHECK SIZE
  // ==================================================

  if (
    audioBlob.size <= 0
  ) {

    console.error(
      "Empty audio blob."
    );

    return;

  }


  if (
    audioBlob.size >
    5 * 1024 * 1024
  ) {

    alert(
      "Voice note is too large. Please record a shorter note."
    );

    return;

  }


  try {

    // ==================================================
    // GET ARRAY BUFFER
    // ==================================================

    const arrayBuffer =
      await audioBlob.arrayBuffer();


    console.log(
      "Sending audio:",
      arrayBuffer.byteLength,
      "bytes"
    );


    // ==================================================
    // CALCULATE DURATION
    // ==================================================

    const duration =
      Date.now() -
      recordingStartTime;


    // ==================================================
    // SEND BINARY AUDIO
    // ==================================================

    socket.emit(
      "voiceMessage",
      {
        audio:
          arrayBuffer,

        mimeType:
          mimeType ||
          audioBlob.type ||
          "audio/webm",

        duration:
          duration
      }
    );


    console.log(
      "Voice note sent."
    );

  }

  catch (error) {

    console.error(
      "Voice message error:",
      error
    );

    alert(
      "Could not send the voice note."
    );

  }

}


// ==================================================
// GAME STATE
// ==================================================

socket.on("state", state => {

  currentState =
    state;


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
  // PLAYERS
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

    renderGame(
      state
    );

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


    clearChat();


    socket.emit(
      "host",
      {
        name:
          name
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
        code:
          code,

        name:
          name
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

    const statusText =
      $("statusText");


    if (statusText) {

      statusText.textContent =
        "SPINNING…";

    }


    show("spinner");

    hide("answers");

    hide("results");

    hide("lobbyChat");


    if (isRecording) {

      stopVoiceRecording();

    }


    animateSpin();

  }


  // ==================================================
  // PLAYING
  // ==================================================

  else if (
    state.status === "playing"
  ) {

    const statusText =
      $("statusText");


    if (statusText) {

      statusText.textContent =
        "GO!";

    }


    hide("spinner");

    show("answers");

    hide("results");

    hide("lobbyChat");


    if (isRecording) {

      stopVoiceRecording();

    }


    const fields =
      $("fields");


    if (
      fields &&
      fields.dataset.letter !==
      state.letter
    ) {

      fieldsBuilt =
        false;

    }


    buildFields(
      state.letter
    );


    const stopBtn =
      $("stopBtn");


    if (stopBtn) {

      stopBtn.disabled =
        false;

    }

  }


  // ==================================================
  // RESULTS
  // ==================================================

  else if (
    state.status === "results"
  ) {

    const statusText =
      $("statusText");


    if (statusText) {

      statusText.textContent =
        "ROUND RESULTS";

    }


    hide("spinner");

    hide("answers");

    show("results");

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


  fieldsBuilt =
    true;


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


  let index =
    0;


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

  const answers =
    {};


  document
    .querySelectorAll(
      ".answerInput"
    )
    .forEach(
      input => {

        answers[
          input.dataset.cat
        ] =
          input.value.trim();

      }
    );


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

      socket.emit(
        "syncAnswers",
        {
          answers:
            getAnswers()
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
        answers:
          answers
      }
    );

  };

}


// ==================================================
// RENDER RESULTS
// ==================================================

function renderResults(
  results
) {

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
  // SHOW ANSWERS
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


  if (stopBtn) {

    stopBtn.disabled =
      false;

  }


  show("lobbyChat");

}
