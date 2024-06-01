document.addEventListener("dblclick", function (event) {
  const word = window.getSelection().toString().trim();
  console.log(word);
});
