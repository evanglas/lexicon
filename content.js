DICTIONARY_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/collegiate/json/";
THESAURUS_ENDPOINT =
  "https://www.dictionaryapi.com/api/v3/references/thesaurus/json/";
AUDIO_URL = "https://media.merriam-webster.com/audio/prons/en/us/mp3/";

WORD_BOX_Y_MARGIN = 15;

function getAudioURL(sound) {
  if (!sound) {
    return null;
  }
  let subdirectory;
  if (sound.audio) {
    if (/^bix/.test(sound.audio)) {
      subdirectory = "bix";
    } else if (/^gg/.test(sound.audio)) {
      subdirectory = "gg";
    } else if (/^[0-9]/.test(sound.audio)) {
      subdirectory = "number";
    } else {
      subdirectory = sound.audio.charAt(0);
    }
  } else {
    return null;
  }
  return `${AUDIO_URL}${subdirectory}/${sound.audio}.mp3`;
}

async function getDefinition(word, dictionary_api_key) {
  const dictResponse = await fetch(
    `${DICTIONARY_ENDPOINT}${word}?key=${dictionary_api_key}`
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

function updateStorage(word, json, timestamp) {
  chrome.storage.local.get("lexicon_storage", function (result) {
    let storage = result.lexicon_storage
      ? JSON.parse(result.lexicon_storage)
      : {};
    if (word in storage) {
      storage[word]["clickCount"] += 1;
      storage[word]["timestamps"].push(timestamp);
    } else {
      storage[word] = { json: json, timestamps: [timestamp], clickCount: 1 };
    }
    chrome.storage.local.set(
      { lexicon_storage: JSON.stringify(storage) },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error setting value of lexicon_storage");
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

function getPreDefText(content) {
  let preDefContent = "";
  if (content.sls) {
    content.sls.forEach((sls) => {
      let slsSpan = `<span class="sls">${sls}</span>`;
      preDefContent += slsSpan;
    });
  }
  if (content.sgram) {
  }
  return preDefContent;
}

function parseAq(aqData) {
  aqArr = [];
  for (const [aqKey, aqValue] of Object.entries(aqData)) {
    if (aqKey === "auth") {
      aqArr.push(`<span class="aq-auth">${aqValue}</span>`);
    } else if (aqKey === "source") {
      aqArr.push(`<span class="aq-source">${aqValue}</span>`);
    } else if (aqKey === "aqdate") {
      aqArr.push(`<span class="aq-date">${aqValue}</span>`);
    } else if (aqKey === "subsource") {
      aqArr.push(...parseAq(aqData[aqKey]));
    }
  }
  return `<span class="aq">― ${aqArr.join(", ")}</span><br>`;
}

function getUnsText(unsData) {
  unsText = "";
  unsData.forEach((unsL1Element) => {
    unsL1Element.forEach((unsL2Element) => {
      let [unsType, unsData] = unsL2Element;
      if (unsType === "text") {
        unsText += `<span class="uns">${"→ " + unsData}</span><br>`;
      } else if (unsType === "vis") {
        unsText += parseVisText(unsData);
      }
    });
  });
  return unsText;
}

function parseVisText(visData) {
  let visText = "";
  visData.forEach((visDict) => {
    for (const [visKey, visValue] of Object.entries(visDict)) {
      if (visKey == "t") {
        visText += `<div class="vis-text">${visValue}</div>`;
      } else if (visKey == "aq") {
        visText += parseAq(visValue);
      }
    }
  });
  return `<div class="vis">${visText}</div>`;
}

function getSenseDefBox(content) {
  const defElement = content.dt || content.et;
  const senseDefBox = document.createElement("div");
  senseDefBox.classList.add("def-box");

  const preDefText = getPreDefText(content);
  let defText = "";
  defElement.forEach((element, index) => {
    let [type, data] = element;
    if (type === "text") {
      if (index == 0 && preDefText) {
        defText += preDefText;
      }
      defText += data;
      if (content.et) {
        return `[${defText}]`;
      }
      defText += "<br>";
    } else if (type == "uns") {
      defText += getUnsText(data);
    } else if (type == "vis") {
      defText += parseVisText(data);
    }
  });
  defText = applyTextParsers(defText);
  senseDefBox.innerHTML = defText;

  return senseDefBox;
}

function parseSenseSdSense(content) {
  const sdSenseBox = document.createElement("div");
  sdSenseBox.classList.add("sd-sense-box");

  return sdSenseBox;
}

function parseSenseEtDt(content) {
  const senseEtDtBox = document.createElement("div");
  senseEtDtBox.classList.add("sense-et-dt-box");

  const senseDefBox = getSenseDefBox(content);
  senseEtDtBox.appendChild(senseDefBox);

  return senseEtDtBox;
}

function parseSenseContent(content) {
  const senseContentBox = document.createElement("div");
  senseContentBox.classList.add("sense-content-box");

  if (content.et || content.dt) {
    senseContentBox.appendChild(parseSenseEtDt(content));
  }

  if (content.sdsense) {
    senseContentBox.appendChild(parseSenseSdSense(content));
  }

  return senseContentBox;
}

function parseBSContent(content) {
  return parseSenseContent(content.sense);
}

function parseSenContent(content) {
  const senContentBox = document.createElement("div");
  senContentBox.classList.add("sen-content-box");

  if (content.sls) {
    let slsText = "";
    content.sls.forEach((sls, index) => {
      slsText += `<span class='sls'>${sls}</span>${index >= 1 ? ", " : ""}`;
    });
    senContentBox.innerHTML = applyTextParsers(slsText);
  }

  return senContentBox;
}

function parseElementContent(sense) {
  const [type, content] = sense;

  if (type === "bs") {
    return parseBSContent(content);
  } else if (type == "sense") {
    return parseSenseContent(content);
  } else if (type == "sen") {
    return parseSenContent(content);
  }
}

function parsePseq(pseqData) {
  const pseqBox = document.createElement("div");
  pseqBox.classList.add("l3-sense-wrapper");

  pseqData.forEach((l3_group, l3_index) => {
    const senseBoxL3 = document.createElement("div");
    senseBoxL3.classList.add("l3-sense-box");

    const [type, data] = l3_group;
    const { sense_number, sense_letter, sense_parentheses } =
      get_sense_id(data);
    if (sense_parentheses) {
      const senseParenthesesLabel = document.createElement("div");
      senseParenthesesLabel.classList.add("sense-parentheses-label");
      senseParenthesesLabel.textContent = `(${sense_parentheses})`;
      senseBoxL3.appendChild(senseParenthesesLabel);
    }

    const senseContentBox = parseElementContent(l3_group);
    senseBoxL3.appendChild(senseContentBox);
    pseqBox.appendChild(senseBoxL3);
  });

  return pseqBox;
}

function parseSenseL2(l2_group, l2_index, hasLetterLabel, pushBelow) {
  const [type, data] = l2_group;
  let usesLetter = true;
  if (type == "sen") {
    usesLetter = false;
  }
  const senseLetter = "abcdefghijklmnopqrstuvwxyz"[l2_index - pushBelow];
  const senseLetterLabel = document.createElement("div");
  senseLetterLabel.classList.add("sense-letter-label");
  senseLetterLabel.textContent =
    hasLetterLabel && usesLetter ? senseLetter : "";

  const l2SenseBox = document.createElement("div");
  l2SenseBox.classList.add("l2-sense-box");
  l2SenseBox.appendChild(senseLetterLabel);
  if (type === "pseq") {
    const pseqBox = parsePseq(data);
    l2SenseBox.appendChild(pseqBox);
  } else {
    const senseContentBox = parseElementContent(l2_group);
    l2SenseBox.appendChild(senseContentBox);
  }

  return [l2SenseBox, usesLetter];
}

function parseSenseL1(l1_group, l1_index) {
  const senseNumber = l1_index + 1;
  const l1SenseBox = document.createElement("div");
  l1SenseBox.classList.add("l1-sense-box");

  // Create sense number label
  const senseNumberLabel = document.createElement("div");
  senseNumberLabel.classList.add("sense-number-label");
  senseNumberLabel.textContent = senseNumber;
  l1SenseBox.appendChild(senseNumberLabel);

  // Create l2 sense group wrapper div
  const l2SenseGroup = document.createElement("div");
  l2SenseGroup.classList.add("l2-sense-wrapper");

  // Parse l2 sense groups
  let pushBelow = 0;
  l1_group.forEach((l2_group, l2_index) => {
    const [senseBoxL2, usesLetter] = parseSenseL2(
      l2_group,
      l2_index,
      l1_group.length != 1,
      pushBelow
    );
    pushBelow = usesLetter ? pushBelow : pushBelow + 1;
    l2SenseGroup.appendChild(senseBoxL2);
  });

  l1SenseBox.appendChild(l2SenseGroup);
  return l1SenseBox;
}

function parseSenseSequence(sseq) {
  const sseqContainer = document.createElement("div");
  sseqContainer.classList.add("sense-sequence");

  if (!sseq || !Array.isArray(sseq)) {
    return sseqContainer;
  }

  sseq.forEach((l1_group, l1_index) => {
    const senseBoxL1 = parseSenseL1(l1_group, l1_index);
    sseqContainer.appendChild(senseBoxL1);
  });

  return sseqContainer;
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
      vdElement.textContent = `${item.vd}`;
      container.appendChild(vdElement);
    }

    if (item.sseq) {
      const sseqElement = parseSenseSequence(item.sseq);
      container.appendChild(sseqElement);
    }
  });

  return container;
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

function getEntryHeader(dictEntry) {
  const { entryWord, entryWordNum } = getWordId(dictEntry);
  const functionalLabel = dictEntry.fl;
  const audioUrl = getAudioURL(dictEntry.hwi?.prs?.[0]?.sound);
  const mwPrs = dictEntry.hwi?.prs?.[0]?.mw;
  const entryHeader = document.createElement("div");
  entryHeader.classList.add("entry-header");

  const entryHeaderWord = document.createElement("span");
  entryHeaderWord.classList.add("entry-header-word");
  entryHeaderWord.innerText = `${entryWord}`;
  entryHeaderWord.classList.add("entry-header-component");

  const entryHeaderFunctionalLabel = document.createElement("span");
  entryHeaderFunctionalLabel.classList.add("entry-header-functional-label");
  entryHeaderFunctionalLabel.innerText = `${functionalLabel}`;
  entryHeaderFunctionalLabel.classList.add("entry-header-component");

  entryHeader.appendChild(entryHeaderWord);
  entryHeader.appendChild(entryHeaderFunctionalLabel);
  if (mwPrs) {
    const entryHeaderMwPrs = document.createElement("span");
    entryHeaderMwPrs.classList.add("entry-header-mw-prs");
    entryHeaderMwPrs.innerText = `${mwPrs}`;
    entryHeaderMwPrs.classList.add("entry-header-component");
    entryHeader.appendChild(entryHeaderMwPrs);
  }

  if (audioUrl) {
    const entryHeaderAudioButton = document.createElement("span");
    entryHeaderAudioButton.classList.add("entry-header-audio-button");
    entryHeaderAudioButton.classList.add("entry-header-component");
    entryHeaderAudioButton.innerText = "🔊";
    entryHeaderAudioButton.onclick = () => {
      const audio = new Audio(audioUrl);
      audio.play();
    };
    entryHeader.appendChild(entryHeaderAudioButton);
  }
  return entryHeader;
}

function displayDefinitions(selection, event, word, dictResponse) {
  const definitionBox = document.createElement("div");
  definitionBox.classList.add("definition-box");

  dictResponse.forEach((dictEntry, index) => {
    if (dictEntry.meta.section != "alpha" || !dictEntry.def) {
      return;
    }
    const entryHeader = getEntryHeader(dictEntry);
    const definitionContent = parseSenses(dictEntry.def);

    const entryBox = document.createElement("div");
    entryBox.classList.add("entry-box");
    entryBox.appendChild(entryHeader);
    entryBox.appendChild(definitionContent);
    definitionBox.appendChild(entryBox);
  });

  return definitionBox;
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

function getWordNotFoundBox(dictResponse) {
  const definitionBox = document.createElement("div");
  definitionBox.classList.add("definition-box");

  const wordNotFound = document.createElement("div");
  wordNotFound.classList.add("word-not-found");
  wordNotFound.innerText = "Word not found. Did you mean:";

  const didYouMeanWords = document.createElement("div");
  didYouMeanWords.classList.add("did-you-mean-words");
  dictResponse.forEach((word, index) => {
    const wordElement = document.createElement("div");
    wordElement.classList.add("did-you-mean-word");
    wordElement.innerText = word;
    didYouMeanWords.appendChild(wordElement);
  });

  definitionBox.appendChild(wordNotFound);
  definitionBox.appendChild(didYouMeanWords);

  return definitionBox;
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

  // For local development
  // const keysJson = await fetch(chrome.runtime.getURL("secrets.json"));
  // const keys = await keysJson.json();
  // dictionary_api_key = keys["DICTIONARY_KEY"];
  // THESAURUS_KEY = keys["THESAURUS_KEY"];

  const result = await new Promise((resolve) => {
    chrome.storage.local.get("lexicon_api_key", function (result) {
      resolve(result);
    });
  });
  // const dictResponseJson = await fetch(
  //   chrome.runtime.getURL("dictionary_responses/tab.json")
  // );
  // const dictResponse = await dictResponseJson.json();

  const dictResponse = await getDefinition(word, result.lexicon_api_key);

  if (dictResponse.length === 0) {
    return;
  }

  let definitionBox;

  if (typeof dictResponse[0] === "string") {
    definitionBox = getWordNotFoundBox(dictResponse);
  } else {
    definitionBox = displayDefinitions(selection, event, word, dictResponse);
  }

  updateStorage(word, dictResponse, new Date().getTime());

  placeDefinitionBox(selection, event, definitionBox);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!definitionBox.contains(target)) {
      definitionBox.classList.add("fade-out");
      setTimeout(() => {
        definitionBox.remove();
      }, 300);
    }
  });
  definitionBox.querySelectorAll(".math").forEach((element) => {
    katex.render(element.textContent, element, {
      throwOnError: false,
    });
  });
}

document.addEventListener("dblclick", handleDoubleClick);
