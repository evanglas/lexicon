let DICTIONARY_KEY;
let THESAURUS_KEY;

DICTIONARY_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/collegiate/json/";
THESAURUS_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/thesaurus/json/";
AUDIO_URL = "https://media.merriam-webster.com/audio/prons/en/us/mp3/";

WORD_BOX_Y_MARGIN = 15;

// export function rmBracketes(str) {
//   return str.replace(/\[.*?\]/g, "");
// }

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

// Parsing text

function trimNonAlphabetical(str) {
  return str.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
}

function processTokens(input) {
  return input
    .replace(/{b}(.+?){\/b}/g, '<span class="bold">$1</span>')
    .replace(/{it}(.+?){\/it}/g, '<span class="italic">$1</span>')
    .replace(/{sc}(.+?){\/sc}/g, '<span class="small-caps">$1</span>')
    .replace(/{inf}(.+?){\/inf}/g, '<span class="subscript">$1</span>')
    .replace(/{sup}(.+?){\/sup}/g, '<span class="superscript">$1</span>')
    .replace(/{p_br}/g, '<span class="paragraph-break"></span>')
    .replace(/{ldquo}/g, '<span class="left-quote">&#8220;</span>')
    .replace(/{rdquo}/g, '<span class="right-quote">&#8221;</span>')
    .replace(/{bc}/g, '<span class="bold-colon">:</span>');
}

function processWordMarkingTokens(input) {
  return input
    .replace(/{gloss}(.+?){\/gloss}/g, '<span class="gloss">$1</span>')
    .replace(/{parahw}(.+?){\/parahw}/g, '<span class="parahw">$1</span>')
    .replace(/{phrase}(.+?){\/phrase}/g, '<span class="phrase">$1</span>')
    .replace(/{qword}(.+?){\/qword}/g, '<span class="qword">$1</span>')
    .replace(/{wi}(.+?){\/wi}/g, '<span class="wi">$1</span>');
}

function createUrl(baseUrl, target, text) {
  if (!target) {
    return baseUrl + encodeURIComponent(text);
  }

  const [urlPart, hashPart] = target.split(":");
  const finalUrlPart = urlPart || encodeURIComponent(text);
  return baseUrl + finalUrlPart + (hashPart ? `#h${hashPart}` : "");
}

// function createUrl(baseUrl, target, text) {
//   const sanitizedTarget = target.replace(/\s/g, "%20");
//   return `${baseUrl}${sanitizedTarget || text}`;
// }

function processLatex(input) {
  const regex = /{latex}([\s\S]*?){\/latex}/g;
  return input.replace(regex, function (match, p1) {
    return `<span class="math">${p1}</span>`;
  });
}

function processCrossReferences(input) {
  const baseUrl = "https://www.merriam-webster.com/dictionary/";

  const replacements = [
    {
      pattern: /{dx}(.+?){\/dx}/g,
      replace: '<span class="dx">&mdash; $1</span>',
    },
    {
      pattern: /{dx_def}(.+?){\/dx_def}/g,
      replace: '<span class="dx_def">($1)</span>',
    },
    {
      pattern: /{dx_ety}(.+?){\/dx_ety}/g,
      replace: '<span class="dx_ety">&mdash; $1</span>',
    },
    {
      pattern: /{ma}(.+?){\/ma}/g,
      replace: '<span class="ma">&mdash; more at $1</span>',
    },
    {
      pattern: /{a_link\|([^|}]+)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(
          baseUrl,
          target,
          text
        )}" class="a_link">${text}</a>`,
    },
    {
      pattern: /{d_link\|([^|}]+)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(
          baseUrl,
          target,
          text
        )}" class="d_link">${text}</a>`,
    },
    {
      pattern: /{i_link\|([^|}]+)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(
          baseUrl,
          target,
          text
        )}" class="i_link"><em>${text}</em></a>`,
    },
    {
      pattern: /{et_link\|([^|}]+)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(
          baseUrl,
          target,
          text
        )}" class="et_link">${text}</a>`,
    },
    {
      pattern: /{mat\|([^|}]+)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(baseUrl, target, text)}" class="mat">${text}</a>`,
    },
    {
      pattern: /{sx\|([^|}]+)\|?([^|}]*)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "") =>
        `<a href="${createUrl(baseUrl, target, text)}" class="sx">${text}</a>`,
    },
    {
      pattern: /{dxt\|([^|}]+)\|?([^|}]*)\|?([^|}]*)\|?([^|}]*)}/g,
      replace: (_, text, target = "", info = "") =>
        `<a href="${createUrl(baseUrl, target, text)}" class="dxt">${text}${
          info ? ` ${info}` : ""
        }</a>`,
    },
  ];

  return replacements.reduce(
    (str, { pattern, replace }) => str.replace(pattern, replace),
    input
  );
}

function applyTextParsers(input) {
  let text1 = processTokens(input);
  let text2 = processWordMarkingTokens(text1);
  let text3 = processCrossReferences(text2);
  let text4 = processLatex(text3);
  return text4;
}

function parseSenses(def) {
  if (!def || !Array.isArray(def)) {
    console.error("Invalid definition structure.");
    return;
  }

  const container = document.createElement("div");
  container.classList.add("definition-container");

  def.forEach((item) => {
    if (item.vd) {
      const vdElement = document.createElement("div");
      vdElement.classList.add("verb-divider");
      vdElement.textContent = `Verb Divider: ${item.vd}`;
      container.appendChild(vdElement);
    }

    if (item.sseq) {
      const sseqElement = parseSenseSequence(item.sseq);
      container.appendChild(sseqElement);
    }
  });

  return container;
}

function get_sense_id(sense) {
  let sense_number;
  let sense_letter;
  let sense_parentheses;
  if (sense.sn) {
    sn_list = sense.sn.split(" ");
    if (sn_list.length == 1 && !isNaN(sn_list[0])) {
      sense_number = sn_list[0];
    } else if (sn_list.length == 1 && /^\(\d+\)$/.test(sn_list[0])) {
      sense_parentheses = sn_list[0].slice(1, -1);
    } else if (sn_list.length == 1) {
      sense_letter = sn_list[0];
    } else {
      sense_number = sn_list[0];
      sense_letter = sn_list[1];
    }
  }
  return { sense_number, sense_letter, sense_parentheses };
}

function parseLetteredSenseDefinitions(senses) {
  // Create sense definition wrapper div
  const senseDefBox = document.createElement("div");
  senseDefBox.classList.add("sense-def-box");

  senses.forEach((sense) => {
    const [sense_number, sense_letter, sense_parentheses, data] = sense;
    Object.keys(data).forEach((key) => {
      if (key !== "et" && key !== "dt") {
        return;
      }
      let [type, text] = data[key][0];
      if (type === "text") {
        const dtElement = document.createElement("div");
        dtElement.classList.add("definition-text-box");
        text = applyTextParsers(text);
        dtElement.innerHTML = key == "et" ? `[${text}]` : text;
        if (sense_parentheses) {
          const senseParenthesesBox = document.createElement("div");
          senseParenthesesBox.classList.add("sense-parentheses-box");

          const senseParenthesesLabel = document.createElement("div");
          senseParenthesesLabel.classList.add("sense-parentheses-label");
          senseParenthesesLabel.innerText = `(${sense_parentheses})`;

          senseParenthesesBox.appendChild(senseParenthesesLabel);
          senseParenthesesBox.appendChild(dtElement);

          senseDefBox.appendChild(senseParenthesesBox);
        } else {
          senseDefBox.appendChild(dtElement);
        }
      } else if (type == "uns") {
        console.log(data[key]);
        let [type, text] = data[key][0][1][0][0];
        if (text) {
          const usage_container = document.createElement("div");
          usage_container.classList.add("usage-container");
          text = applyTextParsers(text);
          usage_container.innerHTML = "→ " + text;
          senseDefBox.appendChild(usage_container);
        }
      }
    });
  });

  return senseDefBox;
}

function parseLetteredSense(senses) {
  // Create sense letter wrapper div
  const senseLetterDefBox = document.createElement("div");
  senseLetterDefBox.classList.add("sense-letter-def-box");

  // Create sense letter label
  const senseLetterLabel = document.createElement("div");
  senseLetterLabel.classList.add("sense-letter-label");
  const senseLetter = senses[0][1];
  senseLetterLabel.textContent = senseLetter;
  senseLetterDefBox.appendChild(senseLetterLabel);

  // Add the sense definitions to sense definition wrapper div
  const defBoxes = parseLetteredSenseDefinitions(senses);
  senseLetterDefBox.appendChild(defBoxes);

  return senseLetterDefBox;
}

function parseNumberedSense(senses) {
  // Create numbered sense wrapper div
  const numberedSenseBox = document.createElement("div");
  numberedSenseBox.classList.add("numbered-sense-box");

  // Create sense number label
  const senseNumberLabel = document.createElement("div");
  senseNumberLabel.classList.add("sense-number-box");
  const senseNumber = senses[0]?.[0];
  senseNumberLabel.textContent = senseNumber;
  numberedSenseBox.appendChild(senseNumberLabel);

  // Create sense letter wrapper div
  const senseLetterBoxes = document.createElement("div");
  senseLetterBoxes.classList.add("sense-letter-boxes");

  // Add the sense letter boxes to sense letter wrapper div
  let last_letter = "a";
  let letter_group = [];
  if (senses.length == 1) {
    senseLetterBoxes.appendChild(parseLetteredSense(senses));
  } else {
    senses.forEach((sense, index) => {
      const [sense_number, sense_letter, sense_parentheses, data] = sense;
      if (sense_letter && sense_letter !== last_letter) {
        if (letter_group.length == 0) {
          letter_group.push(sense);
        }
        let lettered_sb = parseLetteredSense(letter_group);
        senseLetterBoxes.appendChild(lettered_sb);
        letter_group = [];
      }
      letter_group.push(sense);
      last_letter = sense_letter;
    });
  }

  if (letter_group.length > 0) {
    senseLetterBoxes.appendChild(parseLetteredSense(letter_group));
  }

  numberedSenseBox.appendChild(senseLetterBoxes);
  return numberedSenseBox;
}

// senseLetterBoxes.appendChild(senseLetterDefBox);
// if (sense.sdsense) {
//   const sdElement = document.createElement("em");
//   sdElement.classList.add("sense-divider");
//   sdElement.textContent = `Sense Divider: ${sense.sdsense.sd}`;
//   numberedSenseBoxContainer.appendChild(sdElement);

//   sense.sdsense.dt.forEach((definition) => {
//     let [type, text] = definition;
//     if (type === "text") {
//       const sdsenseElement = document.createElement("p");
//       sdsenseElement.classList.add("divided-definition-text");
//       text = applyTextParsers(text);
//       sdsenseElement.innerHTML = "Divided Definition Text: " + text;
//       senseContainer.appendChild(sdsenseElement);
//     }
//   });
// }

function parseSenseElement(element) {
  if (!Array.isArray(element)) {
    return;
  }
  let [type, data] = element;
  if (type === "pseq") {
    return getPseqData(data);
  }
  if (type === "bs" && data.sense) {
    data = data.sense;
  }
  const { sense_number, sense_letter, sense_parentheses } = get_sense_id(data);
  return [[sense_number, sense_letter, sense_parentheses, data]];
}

function getPseqData(data) {
  let pseq_data = [];
  data.forEach((element) => {
    pseq_data.push(...parseSenseElement(element));
  });
  return pseq_data;
}

function parseSenseSequence(sseq) {
  const sseqContainer = document.createElement("div");
  sseqContainer.classList.add("sense-sequence");

  if (!sseq || !Array.isArray(sseq)) {
    return sseqContainer;
  }

  sseq.forEach((sense_number_group, sseq_index) => {
    let senses = [];
    sense_number_group.forEach((element, number_group_index) => {
      senses.push(...parseSenseElement(element));
      // TODO: parse sen
    });
    sseqContainer.appendChild(parseNumberedSense(senses));
  });

  return sseqContainer;
}

function parseSense(sense) {
  const senseContainer = document.createElement("div");
  senseContainer.classList.add("sense");

  if (!sense) {
    return senseContainer;
  }

  if (sense.dt) {
    sense.dt.forEach((definition) => {
      let [type, text] = definition;
      if (type === "text") {
        const dtElement = document.createElement("p");
        dtElement.classList.add("definition-text");
        text = applyTextParsers(text);
        dtElement.innerHTML = text;
        senseContainer.appendChild(dtElement);
      }
    });
  }

  if (sense.sdsense) {
    const sdElement = document.createElement("em");
    sdElement.classList.add("sense-divider");
    sdElement.textContent = `Sense Divider: ${sense.sdsense.sd}`;
    senseContainer.appendChild(sdElement);

    sense.sdsense.dt.forEach((definition) => {
      let [type, text] = definition;
      if (type === "text") {
        const sdsenseElement = document.createElement("p");
        sdsenseElement.classList.add("divided-definition-text");
        text = applyTextParsers(text);
        sdsenseElement.innerHTML = "Divided Definition Text: " + text;
        senseContainer.appendChild(sdsenseElement);
      }
    });
  }

  return senseContainer;
}

function getDefinitionBoxX(selectionX, boxWidth, windowWidth) {
  const scrollX = window.scrollX;
  if (selectionX + boxWidth > scrollX + windowWidth) {
    return scrollX + windowWidth - boxWidth;
  } else {
    return selectionX;
  }
}

function getDefinitionBoxY(selectionY, boxHeight, windowHeight) {
  const scrollY = window.scrollY;
  if (selectionY + boxHeight / 2 - WORD_BOX_Y_MARGIN > scrollY + windowHeight) {
    return selectionY + boxHeight - WORD_BOX_Y_MARGIN - windowHeight;
  } else if (selectionY - boxHeight - WORD_BOX_Y_MARGIN < scrollY) {
    return scrollY;
  } else {
    return selectionY - WORD_BOX_Y_MARGIN - boxHeight;
  }
}

function placeDefinitionBox(selection, event, box) {
  document.body.appendChild(box);

  const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
  const selectionCoords = {
    x: selectionRect.left + window.scrollX,
    y: selectionRect.top + window.scrollY,
    width: selectionRect.width,
    height: selectionRect.height,
  };
  const { innerWidth: windowWidth, innerHeight: windowHeight } = window;

  // Need to requst animation frame since otherwise get stale box dimensions before text is rendered
  requestAnimationFrame(() => {
    const { width: boxWidth, height: boxHeight } = box.getBoundingClientRect();

    const x = getDefinitionBoxX(selectionCoords.x, boxWidth, windowWidth);
    const y = getDefinitionBoxY(selectionCoords.y, boxHeight, windowHeight);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  });
}

function getWordId(dictEntry) {
  const wordId = dictEntry.meta.id.split(":");
  const entryWord = wordId[0];
  const entryWordNum = wordId?.[1] ? wordId[1] : null;
  return { entryWord, entryWordNum };
}

function displayDefinition(selection, event, word, dictResponse) {
  let containers = [];

  dictResponse.forEach((dictEntry) => {
    const { entryWord, entryWordNum } = getWordId(dictEntry);
    if (dictEntry.meta.section != "alpha" || entryWord != word) {
      return;
    }
    if (dictEntry.def) {
      containers.push(parseSenses(dictEntry.def));
    }
  });
  return containers;
}

function adjustSelection(selection, selectedText, word) {
  let range = selection.getRangeAt(0);
  let startOffset = range.startOffset + selectedText.indexOf(word);
  let endOffset = startOffset + word.length;

  range.setStart(range.startContainer, startOffset);
  range.setEnd(range.startContainer, endOffset);

  selection.removeAllRanges();
  selection.addRange(range);
}

// Function to render LaTeX
function renderLaTeX() {
  document.querySelectorAll(".math").forEach(function (element) {
    try {
      katex.render(element.textContent, element, {
        throwOnError: false,
      });
    } catch (err) {
      console.error("KaTeX render error:", err);
    }
  });
}

async function handleDoubleClick(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    return;
  }

  const word = trimNonAlphabetical(selectedText);
  if (!word) {
    return;
  }

  adjustSelection(selection, selectedText, word);

  const keysJson = await fetch(chrome.runtime.getURL("secrets.json"));
  const keys = await keysJson.json();
  DICTIONARY_KEY = keys["DICTIONARY_KEY"];
  THESAURUS_KEY = keys["THESAURUS_KEY"];

  // const dictResponseJson = await fetch(
  //   chrome.runtime.getURL("dictionary_responses/tab.json")
  // );
  // const dictResponse = await dictResponseJson.json();

  const dictResponse = await getDefinition(word);

  if (dictResponse.length === 0) {
    return;
  }

  // updateWordList(word);
  // updateDictionary(word, dictResponse);
  const group_info_list = displayDefinition(
    selection,
    event,
    word,
    dictResponse
  );
  const combinedBox = document.createElement("div");
  group_info_list.forEach((group_info, index) => {
    const group_box = document.createElement("div");
    const group_header = document.createElement("div");
    group_header.classList.add("group-header");
    group_header.innerText = `${word} (${index + 1} of ${
      group_info_list.length
    })`;
    group_box.appendChild(group_header);
    group_box.appendChild(group_info);
    combinedBox.appendChild(group_box);
  });

  combinedBox.classList.add("combined-box");
  placeDefinitionBox(selection, event, combinedBox);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!combinedBox.contains(target)) {
      combinedBox.classList.add("fade-out");
      setTimeout(() => {
        combinedBox.remove();
      }, 300);
    }
  });
  combinedBox.querySelectorAll(".math").forEach((element) => {
    katex.render(element.textContent, element, {
      throwOnError: false,
    });
  });
}

document.addEventListener("dblclick", handleDoubleClick);

// Function to render LaTeX
function renderLaTeX() {
  document.querySelectorAll(".math").forEach(function (element) {
    try {
      katex.render(element.textContent, element, {
        throwOnError: false,
      });
    } catch (err) {
      console.error("KaTeX render error:", err);
    }
  });
}

// // Call the render function
// renderLaTeX();

// // Optionally, observe DOM changes to re-render LaTeX dynamically
// const observer = new MutationObserver(renderLaTeX);
// observer.observe(document.body, { childList: true, subtree: true });
