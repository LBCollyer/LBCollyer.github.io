window.my = {};
my.varDesc = {};

fetch("https://lbcollyer.github.io/varList.csv")
  .then(response => response.text())
  .then(csv => {
    const lines = csv.split("\n").filter(line => line.trim() !== "");
    lines.shift(); // remove header

    lines.forEach(line => {
      const [shortName, fullName, description] = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // split by comma outside quotes

      if (shortName && description) {
        const cleanShort = shortName.trim();
        const cleanDesc = description.trim().replace(/^"|"$/g, "");
        my.varDesc[cleanShort] = cleanDesc;
        // optionally store the full name too:
        my.fullName = my.fullName || {};
        my.fullName[cleanShort] = fullName.trim().replace(/^"|"$/g, "");
      }
    });
  })
  .catch(err => console.error("Failed to load descriptions:", err));

require([
  "esri/layers/FeatureLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/Color",
  "esri/views/navigation/Navigation"
], function(FeatureLayer, UniqueValueRenderer, SimpleMarkerSymbol, Color, Navigation) {
  my.arcgisMap = document.querySelector("arcgis-map");
  my.sYear = 2022;
  my.yearSlider = document.getElementById("yearSlider");
  my.sVar = "PVINM";
  my.selectVar = document.getElementById("varSelector");
  my.sLay = "Facility_Types"
  // Button click event to lift the intro page
  document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("intro").style.transform = "translateY(-100%)";
    setTimeout(() => {
      document.getElementById("intro").style.display = "none";
    }, 1000); // Hide after animation
  });

  //Create 2nd legend
  my.layerNames = ["Facility_Types", "Race_Data", "Admissions", "HIV_Data", "Releases", "Citizenship_Data", "Death_Data", "Jurisdiction_and_Custody_Data", "Prison_and_Jail_Population_Data"];
  my.selectLayer = document.getElementById("layerSelector");
  
  my.layerNames.forEach(name => {
      const option = document.createElement("calcite-option");
      option.value = name;
      option.textContent = name.replace("_", " "); // Formatting for readability
      my.selectLayer.appendChild(option);
  });
  
  // Function to update the year slider range based on available data for the chosen variable
  function updateYearSlider(layer, field) {
    // Determine the appropriate year field name
    //const yearField = layer.name === "Layer 9" ? "Year" : "YEAR";
    const potentialYearFields = ["Year", "YEAR", "year"];
    const yearField = potentialYearFields.find(f => 
      layer.fields.some(fieldInfo => fieldInfo.name === f)
    );
    const query = layer.createQuery();
    query.where = `${field} IS NOT NULL`;
    query.outFields = [yearField];
    query.returnGeometry = false;
  
    layer.queryFeatures(query).then(result => {
      const years = result.features
                          .map(f => f.attributes[yearField])
                          .filter(year => year != null);
      if (years.length > 0) {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        my.yearSlider.min = minYear;
        my.yearSlider.max = maxYear;
        my.yearSlider.value = maxYear;
        my.yearSlider.setAttribute("min-label", minYear);
        my.yearSlider.setAttribute("max-label", maxYear);
        my.sYear = maxYear;
      }
    }).catch(error => console.error("Year query failed:", error));
  }
  //update legend2
  function updateLegend2(classBreakInfos, field) {
    const legendPanel = document.getElementById("legendPanel2");
    legendPanel.innerHTML = ""; // Clear existing legend
    const legendList = document.createElement("calcite-list");
    //Add white no data box
    let listItem1 = document.createElement("calcite-list-item");        
    // Create color box
    const colorBox1 = document.createElement("span");
    colorBox1.style.display = "inline-block";
    colorBox1.style.width = "16px";
    colorBox1.style.height = "16px";
    colorBox1.style.backgroundColor = "white";
    colorBox1.style.marginRight = "8px";
    colorBox1.style.border = "1px solid black";
    listItem1.innerHTML = `
      <div slot="content" style="display: flex; align-items: center;">
        ${colorBox1.outerHTML}
        <span>${"No Data"}</span>
      </div>
    `;
    legendList.appendChild(listItem1);
    classBreakInfos.forEach(info => {
      let listItem = document.createElement("calcite-list-item");        
      // Create color box
      const colorBox = document.createElement("span");
      colorBox.style.display = "inline-block";
      colorBox.style.width = "16px";
      colorBox.style.height = "16px";
      colorBox.style.backgroundColor = info.color;
      colorBox.style.marginRight = "8px";
      colorBox.style.border = "1px solid black";
      listItem.innerHTML = `
        <div slot="content" style="display: flex; align-items: center;">
          ${colorBox.outerHTML}
          <span>${Math.round(info.minValue.toFixed(2))} - ${Math.round(info.maxValue.toFixed(2))}</span>
        </div>
      `;
      legendList.appendChild(listItem);
    });
    legendPanel.appendChild(legendList);
  }

  //Actions done once map view has loaded
  my.arcgisMap.addEventListener("arcgisViewReadyChange", (event) => { 
    my.view = my.arcgisMap.view;
    my.view.navigation.actionMap.mouseWheel= 'none';
    my.storyContainer = document.querySelector(".story-container");
    my.sections = document.querySelectorAll('.story-section');
    my.scrolled = false;
    
    //zoom to Louisiana and show sidebar
    document.addEventListener("wheel", (event) => {
      if (!my.scrolled) {
        const targetLatitude = 31.22130138800436;
        const targetLongitude = -88.6333091760584;
        my.view.goTo({
          center: [targetLongitude, targetLatitude],
          scale: 5000000   
        });
        my.scrolled = true;
        my.storyContainer.style.display = "block"; // Show the container
        setTimeout(() => {
          my.storyContainer.style.opacity = "1"; // Fade it in smoothly
      }, 100);
    }
    });
    
    //zoom out and add other layers when finished louisiana story
    my.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        console.log(entry.target, entry.isIntersecting);
        if (entry.isIntersecting && entry.target === my.sections[my.sections.length - 1]) {
          my.storyContainer.style.opacity = "0";
          my.storyContainer.style.pointerEvents = "none"; // Disable interaction
          my.view.goTo({
            center:[-98, 39],
            scale: 10000000 
          })
          if (my.corFacil) {
            my.corFacil.visible = false;
          }
          my.legend1 = document.querySelector("#legend1");
          my.legend1.style.opacity = "0";
          my.legend1.style.pointerEvents = "none";
          my.legend2 = document.querySelector("#legend2");
          my.legend2.style.display = "block";
          my.legend2.style.opacity = "1";
          updateUI2("Facility_Types");
        }
      });
    }, { threshold: 1.0 }); // Trigger when the last section is fully in view
    my.sections.forEach(section => my.observer.observe(section));
    
    //Get Random Color
    function getRandomColor() {
      return new Color([Math.random() * 255, Math.random() * 255, Math.random() * 255]);
    }
    
    //Render corFacil Layer
    function createRenderer(field, uniqueValues) {
      return new UniqueValueRenderer({
        field,
        uniqueValueInfos: uniqueValues.map(info => ({
          value: info.value,
          symbol: new SimpleMarkerSymbol({
            color: info.color,
            size: 5,
            outline: null
          })
        })),
        defaultSymbol: new SimpleMarkerSymbol({
          color: "gray",
          size: 5,
          outline: null
        })
      });
    }
    //Update Choropleth symbology
    function applyChoroplethSymbology(layer, field, year) {
      let query = layer.createQuery();
      const yearField = layer.name === "Layer 9" ? "Year" : "YEAR";
      query.where = `${yearField} = ${year}`;
      query.outFields = [field];
      query.returnGeometry = false;
  
      layer.queryFeatures(query).then(result => {
        let values = result.features.map(f => f.attributes[field]).filter(v => v !== null);
        
        if (values.length === 0) return;

        let min = Math.min(...values);
        let max = Math.max(...values);
        let step = (max - min) / 5;

        let classBreakInfos = [
            { minValue: min, maxValue: min + step, color: "#fef0d9" },
            { minValue: min + step, maxValue: min + 2 * step, color: "#fdcc8a" },
            { minValue: min + 2 * step, maxValue: min + 3 * step, color: "#fc8d59" },
            { minValue: min + 3 * step, maxValue: min + 4 * step, color: "#e34a33" },
            { minValue: min + 4 * step, maxValue: max, color: "#b30000" }
        ];

        let renderer = {
            type: "class-breaks",
            field: field,
            classBreakInfos: classBreakInfos.map(info => ({
                minValue: info.minValue,
                maxValue: info.maxValue,
                symbol: { type: "simple-fill", color: info.color }
            }))
        };
        layer.renderer = renderer;
      
        // Update popup template dynamically
        layer.popupTemplate = {
            title: "{NAME}",
            content: `<b>${field.replace(/_/g, " ")}:</b> {${field}}`
        };
        updateLegend2(classBreakInfos, field);
      }).catch(error => console.error("Query failed:", error));
    }

    //Update UI2 when new layer selected
    function updateUI2(chosenLayer) {
      my.layerName = "Layer " + (my.layerNames.indexOf(chosenLayer) + 1)
      Object.values(my.lays).forEach(layer => layer.visible = false);
      my.lays[my.layerName].visible = true;
      my.fieldNames = my.lays[my.layerName].fields.map(field => field.name);
      const excludedFields = new Set([
          "STATEFP", "STATENS", "GEOIDFQ", "GEOID", "STUSPS",
          "LSAD", "ALAND", "AWATER", "OBJECTID", "STATEID",
          "Shape__Length", "Shape__Area", "NAME", "YEAR", "OBJECTID_1", "STATE", "State", "Year", "REGION"
      ]);
      const filteredFields = my.fieldNames.filter(name => !excludedFields.has(name));
      my.selectVar = document.getElementById("varSelector");
      my.selectVar.innerHTML = "";
      filteredFields.forEach(name => {
          const option = document.createElement("calcite-option");
          option.value = name;
          option.textContent = name;
          my.selectVar.appendChild(option);
      })
      if (filteredFields.length > 0) {
        my.selectVar.value = filteredFields[0];
      }
      my.sVar = my.selectVar.value || my.fieldNames[0];
      if (my.yearSlider.value) {my.sYear = my.yearSlider.value;}
      // Remove existing popover if present
      const existingPopover = document.getElementById("varDescriptionPopover");
      if (existingPopover) {
        existingPopover.remove();
      }
      
      // Then create and add the new one
      let varDescElement = document.getElementById("varDescription");
      varDescElement.textContent = `${my.fullName[my.sVar]}` || "No description available.";
      let pop = document.createElement("calcite-popover");
      pop.id = "popVarDesc";
      pop.heading = `${my.sVar} Description`;
      pop.headingLevel = 3;
      pop.placement = "right";
      pop.autoClose = true;
      pop.closable = true;
      // Set reference directly to the element
      pop.referenceElement = varDescElement;
      //pop.style.maxWidth = "300px";
      // Create a wrapper div with comprehensive text wrapping properties
      pop.innerHTML = `
        <div style="
          width: 100%; 
          max-width: 300px;
          overflow-wrap: break-word; 
          word-wrap: break-word;
          word-break: break-word;
          white-space: normal;
          hyphens: auto;
        ">
          ${my.varDesc[my.sVar]}
        </div>
      `;
      // Add to document body
      document.body.appendChild(pop);
      // Update the slider range based on available year values for the selected field
      updateYearSlider(my.lays[my.layerName], my.sVar);
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    }
      
    //Update corFacil Legend when new field selected
    function updateLegend(uniqueValueInfos) {
      const legendPanel = document.getElementById("legendPanel");
      legendPanel.innerHTML = ""; // Clear existing legend

      const legendList = document.createElement("calcite-list");
      legendList.layout = "inline";
      legendList.selectionMode = "none";

      uniqueValueInfos.forEach(info => {
        const listItem = document.createElement("calcite-list-item");

        // Create color box
        const colorBox = document.createElement("span");
        colorBox.style.display = "inline-block";
        colorBox.style.width = "16px";
        colorBox.style.height = "16px";
        colorBox.style.backgroundColor = info.color.toHex();
        colorBox.style.marginRight = "8px";
        colorBox.style.border = "1px solid black";

        // Append list item content
        listItem.innerHTML = `
          <div slot="content" style="display: flex; align-items: center;">
            ${colorBox.outerHTML}
            <span>${info.value}</span>
          </div>
        `;
        legendList.appendChild(listItem);
      });
      legendPanel.appendChild(legendList);
    }

    // Create correctional Facilities Layer
    my.corFacil = new FeatureLayer({
      url: "https://services.arcgis.com/FvF9MZKp3JWPrSkg/arcgis/rest/services/Prison_Map/FeatureServer/0",
      popupTemplate: {
        title: "{NAME}",
        content: `
          <b>Type:</b> {Facil_Type}<br>
          <b>Age:</b> {Facil_Age}<br>
          <b>Scope:</b> {Facil_Scop}<br>
          <b>Gender:</b> {Facil_Gend}
        `
      },
      outFields: ["*"]
    });
    
    //Update symbology of corFacil when new field is selected
    function updateSymbology(field) {
      let query = my.corFacil.createQuery();
      query.returnDistinctValues = true;
      query.returnGeometry = false;
      query.outFields = [field];
      my.corFacil.queryFeatures(query).then(result => {
        let values = result.features.map(f => f.attributes[field]);
        let uniqueValues = values.filter((value, index, self) => self.indexOf(value) === index);
        let uniqueValueInfos = uniqueValues.map(value => ({
          value,
          color: getRandomColor()
        }));
        my.corFacil.renderer = createRenderer(field, uniqueValueInfos);
        updateLegend(uniqueValueInfos);
      }).catch(error => console.error("Query failed:", error));
    }

    // Initialize symbology with default field
    updateSymbology("Facil_Type");

    // Event listener for changing corFacil symbolization field
    document.getElementById("symbolFieldSelector").addEventListener("calciteSelectChange", (event) => {
      updateSymbology(event.target.value);
    });
    
    //Event listener for changing other layers legend and symbology
    document.getElementById("layerSelector").addEventListener("calciteSelectChange", (event) => {
      updateUI2(event.target.value);
    });
    
    document.getElementById("varSelector").addEventListener("calciteSelectChange", (event) => {
      my.sVar = event.target.value;
      // Update the slider range based on the newly selected field
      updateYearSlider(my.lays[my.layerName], my.sVar);
      if (my.yearSlider.value) { my.sYear = my.yearSlider.value; }
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });

    document.getElementById("yearSlider").addEventListener("calciteSliderInput", (event) => {
        my.sYear = event.target.value;
        if (my.selectVar.value) { my.sVar = my.selectVar.value; }
        applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });
    // Adding base and data layers
    const baseURL = "https://services.arcgis.com/FvF9MZKp3JWPrSkg/arcgis/rest/services/Prison_Map/FeatureServer/";
    const baseLayers = [33, 34, 10]; 
    baseLayers.forEach(id => {
      my.arcgisMap.addLayer(new FeatureLayer({
        url: `${baseURL}${id}`,
        outFields: ["*"]
      }));
    });
    // Adding layers 1 to 9
    my.lays = {};
    for (let i = 1; i < 10; i++) {
      my.lays[`Layer ${i}`] = new FeatureLayer({
        url: `${baseURL}${i}`,
        outFields: ["*"],
        popupTemplate:{
        title: `{NAME}${my.sYear}`}
      })
      my.arcgisMap.addLayer(my.lays[`Layer ${i}`]);
      my.lays[`Layer ${i}`].visible = false;
    }

    my.arcgisMap.addLayer(my.corFacil);
    my.arcgisMap.basemap = null;
  });
});
