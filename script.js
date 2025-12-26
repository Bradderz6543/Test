const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");

navToggle.addEventListener("click", () => {
  header.classList.toggle("active");
});
