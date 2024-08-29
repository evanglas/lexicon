document.addEventListener("DOMContentLoaded", function () {
  console.log("hi");

  chrome.storage.local.get("wordList", function (result) {
    const words = JSON.parse(result.wordList) || [];
    const wordListElement = document.getElementById("word-list");


    wordListElement.innerHTML = "";

    words.forEach((word) => {
      const listItem = document.createElement("li");
      listItem.textContent = word;
      wordListElement.appendChild(listItem);
    });
  });
});
