document.addEventListener("DOMContentLoaded", function () {
  console.log("hi");
  // Retrieve the words from chrome.storage
  chrome.storage.local.get("wordList", function (result) {
    const words = JSON.parse(result.wordList) || [];
    const wordListElement = document.getElementById("word-list");

    // Clear any existing list items
    wordListElement.innerHTML = "";

    // Populate the list with words
    words.forEach((word) => {
      const listItem = document.createElement("li");
      listItem.textContent = word;
      wordListElement.appendChild(listItem);
    });
  });
});
