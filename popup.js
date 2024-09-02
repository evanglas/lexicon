document.addEventListener("DOMContentLoaded", function () {
  const apiKeyInput = document.getElementById("api-key");
  const saveApiKeyButton = document.getElementById("save-api-key");
  const openWordListButton = document.getElementById("open-word-list");

  // Load saved API key
  chrome.storage.local.get("apiKey", function (result) {
    apiKeyInput.value = result.apiKey || "";
  });

  // Save API key
  saveApiKeyButton.addEventListener("click", function () {
    const apiKey = apiKeyInput.value;
    chrome.storage.local.set({ apiKey: apiKey }, function () {
      alert("API Key saved!");
    });
  });

  // Open word list in a new tab
  openWordListButton.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("word_list.html") });
  });
});
