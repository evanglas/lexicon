document.addEventListener("DOMContentLoaded", function () {
  const apiKeyInput = document.getElementById("api-key");
  const saveApiKeyButton = document.getElementById("save-api-key");
  const openWordListButton = document.getElementById("open-word-list");

  chrome.storage.local.get("lexicon_api_key", function (result) {
    apiKeyInput.value = result.lexicon_api_key || "";
    apiKeyInput.disabled = true;
    apiKeyInput.style.backgroundColor = "#f0f0f0";
    saveApiKeyButton.textContent = "Edit";
  });

  saveApiKeyButton.addEventListener("click", function () {
    if (apiKeyInput.disabled) {
      apiKeyInput.disabled = false;
      apiKeyInput.style.backgroundColor = "";
      saveApiKeyButton.textContent = "Save";
    } else {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({ lexicon_api_key: apiKey }, function () {
          apiKeyInput.disabled = true;
          apiKeyInput.style.backgroundColor = "#f0f0f0";
          saveApiKeyButton.textContent = "Edit";
        });
      }
    }
  });

  openWordListButton.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("word_list.html") });
  });
});
