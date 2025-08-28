
// dataLoader.js
// Handles loading of external CSV data including variable descriptions and Indiana prison population.

export const my = {
  varDesc: {},
  fullName: {},
  indianaPopMap: {}
};

export function loadVariableDescriptions() {
  return fetch("https://lbcollyer.github.io/varList.csv")
    .then(response => response.text())
    .then(csv => {
      const lines = csv.split("
").filter(line => line.trim() !== "");
      lines.shift();
      lines.forEach(line => {
        const [shortName, fullName, description] = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (shortName && description) {
          const cleanShort = shortName.trim();
          const cleanDesc = description.trim().replace(/^"|"$/g, "");
          my.varDesc[cleanShort] = cleanDesc;
          my.fullName[cleanShort] = fullName.trim().replace(/^"|"$/g, "");
        }
      });
    })
    .catch(err => console.error("Failed to load descriptions:", err));
}

export function loadIndianaPopulation() {
  return fetch("Indiana Prison Population.csv")
    .then(response => response.text())
    .then(csv => {
      const lines = csv.split("
").filter(line => line.trim() !== "");
      const data = lines.slice(1);
      data.forEach(line => {
        const [Year, Jail, Prison, Combined] = line.split(",");
        my.indianaPopMap[Year.trim()] = {
          Jail_Population__Adjusted_: parseFloat(Jail),
          Prison_population: parseFloat(Prison),
          Combined_Pop: parseFloat(Combined)
        };
      });
    })
    .catch(err => console.error("Failed to load Indiana CSV", err));
}
