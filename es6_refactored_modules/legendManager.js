
// legendManager.js
// Responsible for updating legends for choropleth and facility layers.

export function updateLegend2(classBreakInfos, field) {
  const legendPanel = document.getElementById("legendPanel2");
  legendPanel.innerHTML = "";
  legendPanel.heading = `% individuals in ${field}`;
  const legendList = document.createElement("calcite-list");

  let listItem1 = document.createElement("calcite-list-item");
  const colorBox1 = document.createElement("span");
  colorBox1.style.display = "inline-block";
  colorBox1.style.width = "16px";
  colorBox1.style.height = "16px";
  colorBox1.style.backgroundColor = "#AAAAAA";
  colorBox1.style.marginRight = "8px";
  colorBox1.style.border = "1px solid black";
  listItem1.innerHTML = `<div slot='content' style='display: flex; align-items: center;'>${colorBox1.outerHTML}<span>No Data</span></div>`;
  legendList.appendChild(listItem1);

  classBreakInfos.forEach(info => {
    let listItem = document.createElement("calcite-list-item");
    const colorBox = document.createElement("span");
    colorBox.style.display = "inline-block";
    colorBox.style.width = "16px";
    colorBox.style.height = "16px";
    colorBox.style.backgroundColor = info.color;
    colorBox.style.marginRight = "8px";
    colorBox.style.border = "1px solid black";
    listItem.innerHTML = `<div slot='content' style='display: flex; align-items: center;'>${colorBox.outerHTML}<span>${Math.round(info.minValue)} - ${Math.round(info.maxValue)}</span></div>`;
    legendList.appendChild(listItem);
  });

  legendPanel.appendChild(legendList);
}
