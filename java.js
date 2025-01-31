//javascript
const darkModeToggle = document.getElementById('darkToggle');
const currentTheme = localStorage.getItem('theme');

if (currentTheme === 'dark') {
  document.body.classList.add('dark-mode');
  darkModeToggle.classList.add('dark-mode');
}

darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  darkModeToggle.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    localStorage.setItem('theme', 'dark');
    darkModeToggle.innerHTML = 🌙;
  } else {
    localStorage.setItem('theme','light');
    darkModeToggle.innerHTML = ☀️;
  }
});
