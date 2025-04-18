window.my = {};
my.varDesc = {};

fetch("https://lbcollyer.github.io/varList.csv")
  .then(response => response.text())
  .then(csv => {
    const lines = csv.split("\n").filter(line => line.trim() !== "");
    lines.shift(); // remove header
    lines.forEach(line => {
      const [variable, description] = line.split(/,(.+)/); // split only on first comma
      if (variable && description) {
        my.varDesc[variable.trim()] = description.trim().replace(/^"|"$/g, "");
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
        const targetLatitude = 31.0667;
        const targetLongitude = -75.0000;
        my.view.goTo({
          center: [targetLongitude, targetLatitude],
          zoom: 7  // Set zoom level as needed
        }).then(() => {
          my.view.zoom = 7;
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
            zoom: 5
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
//---------------------------------------------------------------------------------------------------------------------------------------
//Helper functions for apply choropleth
    function getPopulationLookup(popResult) {
      const popMap = {}, popSourceMap = {};
      const popFields = ["Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
    
      popResult.features.forEach(({ attributes }) => {
        const state = attributes.NAME;
        for (const field of popFields) {
          const val = attributes[field];
          if (val != null && val > 0) {
            popMap[state] = val;
            popSourceMap[state] = field;
            break;
          }
        }
      });
    
      return { popMap, popSourceMap };
    }
    
    function getNormalizedRenderer(field, popMapJSON, min, max, step) {
      return {
        type: "simple",
        symbol: { type: "simple-fill", color: "#AAAAAA" },
        visualVariables: [{
          type: "color",
          valueExpression: `
            var stateName = $feature.NAME;
            var value = $feature["${field}"];
            var popMap = ${popMapJSON};
            var pop = popMap[stateName];
          
            if (pop > 0 && value != null) {
              return (value / pop) * 100;
            }
            return null;
          `,
          stops: [
            { value: min, color: "#fef0d9" },
            { value: min + step, color: "#fdcc8a" },
            { value: min + 2 * step, color: "#fc8d59" },
            { value: min + 3 * step, color: "#e34a33" },
            { value: min + 4 * step, color: "#e34a33" },
            { value: max, color: "#b30000" }
          ]
        }]
      };
    }
    
    function getClassBreakRenderer(field, classBreakInfos) {
      return {
        type: "class-breaks",
        field,
        classBreakInfos: classBreakInfos.map(info => ({
          minValue: info.minValue,
          maxValue: info.maxValue,
          symbol: { type: "simple-fill", color: info.color }
        }))
      };
    }
    
    function getNormalizedPopupTemplate(field, values, popMap, sourceMap) {
      const fieldLabel = field.replace(/_/g, " ");
    
      // Build Arcade-compatible stringified maps
      const popMapJSON = JSON.stringify(popMap);
      const popSourceMapJSON = JSON.stringify(sourceMap);
      const sourceLabels = {
        "Combined_Pop": "Combined Population",
        "Prison_population": "Prison Population",
        "Jail_Population__Adjusted_": "Jail Population (Adjusted)"
      };
      const sourceLabelsJSON = JSON.stringify(sourceLabels);
    
      return {
        title: "{NAME}",
        content: `
          <b>${fieldLabel}:</b> {${field}}<br>
          <b>Population Data Source:</b> {expression/populationSource}<br>
          <b>Population Value:</b> {expression/population}<br>
          <b>Percentage of incarcerated individuals:</b> {expression/normalizedRate}
        `,
        expressionInfos: [
          {
            name: "normalizedRate",
            expression: `
              var value = $feature["${field}"];
              var stateName = $feature.NAME;
              var popMap = ${popMapJSON};
              var pop = popMap[stateName];
              
              if (pop > 0 && value != null) {
                return Text((value / pop) * 100, "#,##0.00");
              }
              return "No population data";
            `
          },
          {
            name: "population",
            expression: `
              var stateName = $feature.NAME;
              var popMap = ${popMapJSON};
              var pop = popMap[stateName];
              
              if (pop > 0) {
                return Text(pop, "#,##0");
              }
              return "No data";
            `
          },
          {
            name: "populationSource",
            expression: `
              var stateName = $feature.NAME;
              var sourceMap = ${popSourceMapJSON};
              var labels = ${sourceLabelsJSON};
              var source = sourceMap[stateName];
              
              if (HasKey(labels, source)) {
                return labels[source];
              } else if (source != null) {
                return source;
              } else {
                return "None (Data Unavailable)";
              }
            `
          }
        ]
      };
    }


//---------------------------------------------------------------------------------------------------------------------------------------    
    async function applyChoroplethSymbology(layer, field, year) {
      const yearField = layer.name === "Layer 9" ? "Year" : "YEAR";
      const fieldLabel = field.replace(/_/g, " ");
    
      const shouldNormalize = my.shouldNormalize &&
        !["Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"].includes(field);
    
      // Main query for the display layer
      const query = layer.createQuery();
      query.where = `${yearField} = ${year}`;
      query.outFields = ["NAME", field];
      query.returnGeometry = false;
    
      // Optional query for population data
      let popMap = {}, popSourceMap = {};
      if (shouldNormalize) {
        const popLayer = my.lays["Layer 9"];
        const popQuery = popLayer.createQuery();
        popQuery.where = `Year = ${year}`;
        popQuery.outFields = ["NAME", "Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
        popQuery.returnGeometry = false;
    
        try {
          const popResult = await popLayer.queryFeatures(popQuery);
          ({ popMap, popSourceMap } = getPopulationLookup(popResult));
        } catch (err) {
          console.error("Failed to load population data", err);
        }
      }
    
      try {
        const result = await layer.queryFeatures(query);
    
        let valueMap = {};
        let popSourceMap = {};
        let classValues = [];
        
        result.features.forEach(f => {
          const val = f.attributes[field];
          const state = f.attributes.NAME;
        
          if (val != null) {
            if (!popMap[state]) {
              valueMap[state] = null;
              classValues.push(null);
            } else if (shouldNormalize) {
              const normalizedVal = (val / popMap[state]) * 100;
              valueMap[state] = normalizedVal;
              classValues.push(normalizedVal);
            } else {
              valueMap[state] = val;
              classValues.push(val);
            }
          }
        });
        
        const min = Math.min(...classValues);
        const max = Math.max(...classValues);
        const step = (max - min) / 5;
    
        const classBreakInfos = [
          { minValue: min, maxValue: min + step, color: "#fef0d9" },
          { minValue: min + step, maxValue: min + 2 * step, color: "#fdcc8a" },
          { minValue: min + 2 * step, maxValue: min + 3 * step, color: "#fc8d59" },
          { minValue: min + 3 * step, maxValue: min + 4 * step, color: "#e34a33" },
          { minValue: min + 4 * step, maxValue: max, color: "#b30000" }
        ];
        
        const valueMapJSON = JSON.stringify(valueMap);
        const popMapJSON = JSON.stringify(popMap);
        const popSourceMapJSON = JSON.stringify(popSourceMap);
        const sourceLabelsJSON = JSON.stringify({
          "Combined_Pop": "Combined Population",
          "Prison_population": "Prison Population",
          "Jail_Population__Adjusted_": "Jail Population (Adjusted)"
        });
    
        // Update renderer
        layer.renderer = shouldNormalize
          ? getNormalizedRenderer(field, popMapJSON, min, max, step)
          : getClassBreakRenderer(field, classBreakInfos);
    
        // Update popup
        layer.popupTemplate = shouldNormalize
          ? getNormalizedPopupTemplate(field, valueMap, popMap, popSourceMap)
          : {
              title: "{NAME}",
              content: `<b>${fieldLabel}:</b> {${field}}`
            };
    
        updateLegend2(classBreakInfos, shouldNormalize ? `${fieldLabel} (Rate per 100,000)` : fieldLabel);
      } catch (err) {
        console.error("Queries failed:", err);
      }
    }

//---------------------------------------------------------------------------------------------------
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
      document.getElementById("varDescription").textContent = my.varDesc[my.sVar] || "No description available.";
    });

    document.getElementById("yearSlider").addEventListener("calciteSliderInput", (event) => {
        my.sYear = event.target.value;
        if (my.selectVar.value) { my.sVar = my.selectVar.value; }
        applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });
    // Add a toggle for normalization to your HTML
    // <calcite-switch id="normalizeToggle" label="Normalize by Population"></calcite-switch>
    
    // Then update your event listeners:
    document.getElementById("normalizeToggle").addEventListener("calciteSwitchChange", (event) => {
      my.shouldNormalize = event.target.checked;
      if (my.selectVar.value) { my.sVar = my.selectVar.value; }
      if (my.yearSlider.value) { my.sYear = my.yearSlider.value; }
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });
    
    // Make sure to initialize the normalization setting in your initial setup
    my.shouldNormalize = document.getElementById("normalizeToggle").checked;
    // Adding base and data layers
    const baseURL = "https://services.arcgis.com/FvF9MZKp3JWPrSkg/arcgis/rest/services/Prison_Map/FeatureServer/";
    const baseLayers = [34, 10]; 
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
        title: "{NAME}"}
      })
      my.arcgisMap.addLayer(my.lays[`Layer ${i}`]);
      my.lays[`Layer ${i}`].visible = false;
    }

    my.arcgisMap.addLayer(my.corFacil);
    my.arcgisMap.basemap = null;
  });
});
