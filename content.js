let DICTIONARY_KEY;
let THESAURUS_KEY;

DICTIONARY_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/collegiate/json/";
THESAURUS_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/thesaurus/json/";
AUDIO_URL = "https://media.merriam-webster.com/audio/prons/en/us/mp3/";

function getAudioURL(sound) {
  let subdirectory;
  if (sound.audio) {
    if (/^bix/.test(sound.audio)) {
      subdirectory = "bix";
    } else if (/^gg/.test(sound.audio)) {
      subdirectory = "gg";
    } else if (/^[0-9\p]/.test(sound.audio)) {
      subdirectory = "number";
    } else {
      subdirectory = sound.audio.charAt(0);
    }
  } else {
    return null;
  }
  return `${AUDIO_URL}${subdirectory}/${sound.audio}.mp3`;
}

async function getDefinition(word) {
  const dictResponse = await fetch(
    `${DICTIONARY_ENDPOINT}${word}?key=${DICTIONARY_KEY}`
  );
  return await dictResponse.json();
}

function getLocalDictionary(callback) {
  chrome.storage.local.get("dictionary", function (result) {
    let dictionary = result.dictionary ? JSON.parse(result.dictionary) : {};
    callback(dictionary);
  });
}
function updateDictionary(word, json) {
  getLocalDictionary(function (dictionary) {
    dictionary[word] = json;
    chrome.storage.local.set(
      { dictionary: JSON.stringify(dictionary) },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error setting value of dictionary");
        }
      }
    );
  });
  console.log("Added " + word + " to dictionary");
}

function getLocalWordList(callback) {
  chrome.storage.local.get("wordList", function (result) {
    let wordList = result.wordList ? JSON.parse(result.wordList) : [];
    callback(wordList);
  });
}

function updateWordList(word) {
  getLocalWordList(function (wordList) {
    if (!wordList.includes(word)) {
      wordList.push(word);
    }
    chrome.storage.local.set(
      { wordList: JSON.stringify(wordList) },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error setting value of wordList");
        }
      }
    );
  });
}

function getWord(dictResponse) {
  const id = dictResponse[0].meta.id;
  return id.split(":")[0];
}

function trimNonAlphabetical(str) {
  return str.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
}

function displayDefinition(event, word, dictResponse) {
  let existingBox = document.getElementById("double-click-box");
  if (existingBox) {
    existingBox.remove();
  }
  // Create a new box
  const shortDef = dictResponse[0].shortdef[0];
  console.log("Displaying Definition");
  let box = document.createElement("div");
  box.id = "double-click-box";
  box.textContent = shortDef;
  document.body.appendChild(box);

  // Position the box at the cursor location
  console.log(event.pageX, event.pageY);
  box.style = `position: absolute;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  z-index: 10000;
  transform: translate(-50%, -50%);
  pointer-events: none;`;
  box.style.left = `${event.pageX}px`;
  box.style.top = `${event.pageY}px`;
}

async function handleDoubleClick(event) {
  const keysJson = await fetch(chrome.runtime.getURL("secrets.json"));
  const keys = await keysJson.json();

  DICTIONARY_KEY = keys["DICTIONARY_KEY"];
  THESAURUS_KEY = keys["THESAURUS_KEY"];

  const selection = window.getSelection().toString().trim();
  const word = trimNonAlphabetical(selection);

  if (!word) {
    return;
  }

  const dictResponse = await getDefinition(word);

  console.log(dictResponse);

  if (dictResponse.length === 0) {
    return;
  }

  updateWordList(word);
  updateDictionary(word, dictResponse);
  displayDefinition(event, word, dictResponse);
}

document.addEventListener("dblclick", handleDoubleClick);
