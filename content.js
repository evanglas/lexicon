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
  console.log("base", baseUrl);
  console.log("target", target);
  console.log("text", text);
  if (!target) {
    return baseUrl + encodeURIComponent(text);
  }

  const [urlPart, hashPart] = target.split(":");
  const finalUrlPart = urlPart || encodeURIComponent(text);
  return baseUrl + finalUrlPart + (hashPart ? `#h${hashPart}` : "");
}

// function createUrl(baseUrl, target, text) {
//   console.log(baseUrl, target, text);
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
  // console.log(text1, text2, text3);
  return text4;
}

// Parsing sense structure

function parseSenses(def) {
  // console.log(def);
  if (!def || !Array.isArray(def)) {
    console.error("Invalid definition structure.");
    return;
  }

  const container = document.createElement("div");
  container.classList.add("definition-container");

  def.forEach((item) => {
    if (item.vd) {
      const vdElement = document.createElement("p");
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
  if (sense.sn) {
    sn_list = sense.sn.split(" ");
    if (sn_list.length == 1 && !isNaN(sn_list[0])) {
      sense_number = sn_list[0];
    } else if (sn_list.length == 1) {
      sense_letter = sn_list[0];
    } else {
      sense_number = sn_list[0];
      sense_letter = sn_list[1];
    }
  }
  return { sense_number, sense_letter };
}

function parseNumberedSense(senses) {
  const numberedSenseBox = document.createElement("div");
  numberedSenseBox.classList.add("numbered-sense-box");

  const senseNumberBox = document.createElement("div");
  senseNumberBox.classList.add("sense-number-box");
  const senseNumber = senses[0][0];
  senseNumberBox.textContent = senseNumber;
  numberedSenseBox.appendChild(senseNumberBox);

  const senseLetterBoxes = document.createElement("div");
  senseLetterBoxes.classList.add("sense-letter-boxes");

  senses.forEach((sense) => {
    const senseLetterDefBox = document.createElement("div");
    senseLetterDefBox.classList.add("sense-letter-def-box");
    if (sense[1]) {
      const senseLetterBox = document.createElement("div");
      senseLetterBox.classList.add("sense-letter-box");
      senseLetterBox.textContent = sense[1];
      senseLetterDefBox.appendChild(senseLetterBox);
    }

    const senseDefBox = document.createElement("div");
    senseDefBox.classList.add("sense-def-box");

    if (sense[2]) {
      sense[2].dt.forEach((definition) => {
        let [type, text] = definition;
        if (type === "text") {
          const dtElement = document.createElement("p");
          dtElement.classList.add("definition-text-box");
          text = applyTextParsers(text);
          dtElement.innerHTML = text;
          senseDefBox.appendChild(dtElement);
          senseLetterDefBox.appendChild(senseDefBox);
        }
      });
    }
    senseLetterBoxes.appendChild(senseLetterDefBox);
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
  });
  numberedSenseBox.appendChild(senseLetterBoxes);
  return numberedSenseBox;
}

function parseSenseSequence(sseq) {
  const sseqContainer = document.createElement("div");
  sseqContainer.classList.add("sense-sequence");

  if (!sseq || !Array.isArray(sseq)) {
    return sseqContainer;
  }

  let last_sn = 1;
  let senses = [];

  sseq.forEach((group) => {
    group.forEach((element) => {
      if (Array.isArray(element)) {
        const [type, data] = element;
        if (type === "sense") {
          const { sense_number, sense_letter } = get_sense_id(data);
          if (sense_number && sense_number != last_sn) {
            let numbered_sb = parseNumberedSense(senses);
            sseqContainer.appendChild(numbered_sb);
            senses = [];
          }
          senses.push([sense_number, sense_letter, data]);
          // const senseElement = parseSense(data);
          // sseqContainer.appendChild(senseElement);
        } // else if (type === "bs") {
        //   const bsElement = document.createElement("p");
        //   bsElement.classList.add("binding-substitute");
        //   bsElement.textContent = "Binding Substitute:";
        //   sseqContainer.appendChild(bsElement);
        //   sseqContainer.appendChild(parseSense(data.sense));
        // } else if (type === "pseq") {
        //   const pseqElement = document.createElement("p");
        //   pseqElement.classList.add("parenthesized-sequence");
        //   pseqElement.textContent = "Parenthesized Sense Sequence:";
        //   sseqContainer.appendChild(pseqElement);
        //   sseqContainer.appendChild(parseSenseSequence(data));
        // } else if (type === "sen") {
        //   const senElement = document.createElement("p");
        //   senElement.classList.add("truncated-sense");
        //   senElement.textContent = "Truncated Sense:";
        //   sseqContainer.appendChild(senElement);
        //   sseqContainer.appendChild(parseSense(data));
        // }
      }
    });
  });

  return sseqContainer;
}

function parseSense(sense) {
  const senseContainer = document.createElement("div");
  senseContainer.classList.add("sense");

  if (!sense) {
    return senseContainer;
  }

  if (sense.sn) {
    const snElement = document.createElement("strong");
    snElement.classList.add("sense-number");
    snElement.textContent = `Sense Number: ${sense.sn}`;
    senseContainer.appendChild(snElement);
  }

  if (sense.dt) {
    sense.dt.forEach((definition) => {
      let [type, text] = definition;
      if (type === "text") {
        const dtElement = document.createElement("p");
        dtElement.classList.add("definition-text");
        // console.log(text);
        text = applyTextParsers(text);
        dtElement.innerHTML = text;
        // dtElement.textContent = `Definition Text: ${text}`;
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
  // console.log(selectionX, boxWidth, windowWidth);
  if (selectionX + boxWidth > scrollX + windowWidth) {
    return scrollX + windowWidth - boxWidth;
  } else {
    return selectionX;
  }
}

function getDefinitionBoxY(selectionY, boxHeight, windowHeight) {
  const scrollY = window.scrollY;
  if (selectionY + boxHeight / 2 - WORD_BOX_Y_MARGIN > scrollY + windowHeight) {
    console.log(1);
    return selectionY + boxHeight - WORD_BOX_Y_MARGIN - windowHeight;
  } else if (selectionY - boxHeight - WORD_BOX_Y_MARGIN < scrollY) {
    console.log(2);
    return scrollY;
  } else {
    console.log(3);
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

    console.log(selectionCoords.y, boxHeight, windowHeight);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  });
}

// function displayDefinition(selection, event, word, dictResponse) {
//   let existingBox = document.getElementById("double-click-box");
//   if (existingBox) {
//     existingBox.remove();
//   }

//   let box = document.createElement("div");

//   box.style.maxHeight = "150px";
//   box.style.maxWidth = "400px";
//   box.style.overflowY = "auto";
//   box.style.border = "1px solid #ccc";
//   box.style.padding = "5px";
//   box.style.borderRadius = "5px";
//   box.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
//   box.style.backgroundColor = "#f9f9f9";
//   box.style.position = "absolute";

//   dictResponse.forEach((dictEntry, index) => {
//     const { entryWord, entryWordNum } = getWordId(dictEntry);

//     if (entryWord !== word) {
//       return;
//     }

//     const entryWordDefs = dictEntry.def[0].sseq;

//     let subSenses = [];
//     let curSenseNumber = null;
//     entryWordDefs.forEach((sense) => {
//       const { senseNumber, senseLetter } = getSenseId(sense);
//       curSenseNumber = senseNumber ? senseNumber : curSenseNumber;
//       if (senseLetter != null) {
//         subSenses.push([sense, curSenseNumber, senseLetter]);
//       } else {
//         subSenses.push([sense, curSenseNumber, null]);
//       }
//     });

//     let entryBox = document.createElement("div");
//     entryBox.style.display = "flex";
//     entryBox.style.alignItems = "center";
//     entryBox.style.marginBottom = "10px";
//     entryBox.style.padding = "10px";
//     entryBox.style.borderBottom = "1px solid #ddd";

//     const numberLabel = document.createElement("span");
//     numberLabel.textContent = `${index + 1}. `;
//     numberLabel.style.fontWeight = "bold";
//     numberLabel.style.marginRight = "5px";

//     const shortDef = dictEntry?.shortdef?.[0]
//       ? dictEntry.shortdef[0]
//       : "Definition not available";
//     const partOfSpeech = dictEntry?.fl ? dictEntry.fl : "Unknown";
//     const audioUrl = dictEntry?.hwi?.prs?.[0]?.sound
//       ? getAudioURL(dictEntry.hwi.prs[0].sound)
//       : null;

//     const contentBox = document.createElement("div");
//     contentBox.style.display = "flex";
//     contentBox.style.alignItems = "center";

//     // Create and style the elements to be added to entryBox
//     const defElement = document.createElement("p");
//     defElement.textContent = shortDef;
//     defElement.style.display = "inline";
//     defElement.style.margin = "5px 0";
//     defElement.style.fontSize = "14px";

//     const posElement = document.createElement("span");
//     posElement.textContent = `(${partOfSpeech})`;
//     posElement.style.fontStyle = "italic";
//     posElement.style.marginLeft = "10px";
//     posElement.style.color = "#555";

//     const audioIcon = document.createElement("span");
//     audioIcon.innerHTML = "🔊"; // simple audio icon
//     audioIcon.style.cursor = "pointer";
//     audioIcon.style.marginLeft = "10px";
//     audioIcon.title = "Play audio";
//     audioIcon.addEventListener("click", () => {
//       if (audioUrl) {
//         let audio = new Audio(audioUrl);
//         audio.play();
//       } else {
//         alert("No audio available");
//       }
//     });

//     const addButton = document.createElement("button");
//     addButton.textContent = "Add to Dictionary";
//     addButton.style.marginLeft = "10px";
//     addButton.style.padding = "5px 10px";
//     addButton.style.border = "none";
//     addButton.style.borderRadius = "3px";
//     addButton.style.backgroundColor = "#007bff";
//     addButton.style.color = "#fff";
//     addButton.style.cursor = "pointer";
//     addButton.addEventListener("click", () => {
//       addToDictionary(dictEntry); // assuming addToDictionary is a function you’ve defined
//     });

//     // Append elements to the entryBox
//     entryBox.appendChild(numberLabel);
//     contentBox.appendChild(defElement);
//     contentBox.appendChild(posElement);
//     contentBox.appendChild(audioIcon);
//     contentBox.appendChild(addButton);
//     entryBox.appendChild(contentBox);

//     // Append entryBox to the main box
//     box.appendChild(entryBox);
//   });

//   // Now append the box to the body or another element
//   // document.body.appendChild(box);

function getWordId(dictEntry) {
  const wordId = dictEntry.meta.id.split(":");
  const entryWord = wordId[0];
  const entryWordNum = wordId?.[1] ? wordId[1] : null;
  return { entryWord, entryWordNum };
}

function displayDefinition(selection, event, word, dictResponse) {
  console.log("Displaying Definition");
  let containers = [];
  dictResponse.forEach((dictEntry) => {
    const { entryWord, entryWordNum } = getWordId(dictEntry);

    // if (entryWord !== word) {
    //   return;
    // }

    containers.push(parseSenses(dictEntry.def));
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
  const dictResponseJson = await fetch(
    chrome.runtime.getURL("dictionary_responses/series.json")
  );
  const keys = await keysJson.json();
  const dictResponse = await dictResponseJson.json();

  DICTIONARY_KEY = keys["DICTIONARY_KEY"];
  THESAURUS_KEY = keys["THESAURUS_KEY"];

  // const dictResponse = await getDefinition(word);

  if (dictResponse.length === 0) {
    return;
  }

  // updateWordList(word);
  // updateDictionary(word, dictResponse);
  const boxes = displayDefinition(selection, event, word, dictResponse);
  const combinedBox = document.createElement("div");
  boxes.forEach((box) => {
    combinedBox.appendChild(box);
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
