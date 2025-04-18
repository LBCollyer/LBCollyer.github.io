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
    function applyChoroplethSymbology(layer, field, year) {
      const yearField = layer.name === "Layer 9" ? "Year" : "YEAR";
      
      // First, check if we should normalize
      const shouldNormalize = my.shouldNormalize && 
        field !== "Combined_Pop" && 
        field !== "Prison_population" && 
        field !== "Jail_Population__Adjusted_";
      
      // Step 1: Get the current layer data
      let query = layer.createQuery();
      query.where = `${yearField} = ${year}`;
      query.outFields = ["NAME", field];
      query.returnGeometry = false;
      
      // Step 2: If normalizing, also get population data from Layer 9
      let populationPromise;
      if (shouldNormalize) {
        const popLayer = my.lays["Layer 9"]; // Prison_and_Jail_Population_Data layer
        let popQuery = popLayer.createQuery();
        popQuery.where = `Year = ${year}`;
        popQuery.outFields = ["NAME", "Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
        popQuery.returnGeometry = false;
        populationPromise = popLayer.queryFeatures(popQuery);
      }
      
      // Execute queries and process results
      Promise.all([
        layer.queryFeatures(query),
        shouldNormalize ? populationPromise : Promise.resolve(null)
      ]).then(([result, popResult]) => {
        // Create lookup map for population data if normalizing
        let popMap = {};
        let popSourceMap = {}; // Which field was used for each state
        
        if (shouldNormalize && popResult) {
          // Process population data with fallback logic
          popResult.features.forEach(feature => {
            const stateName = feature.attributes.NAME;
            
            // Try each population field in order
            const popFields = ["Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
            let populationValue = null;
            let sourceField = null;
            
            for (const popField of popFields) {
              const val = feature.attributes[popField];
              if (val !== null && val > 0) {
                populationValue = val;
                sourceField = popField;
                break; // Use the first valid population value we find
              }
            }
            
            if (populationValue !== null) {
              popMap[stateName] = populationValue;
              popSourceMap[stateName] = sourceField;
            }
          });
          
          console.log("Population data available for states:", Object.keys(popMap));
          console.log("Population sources used:", popSourceMap);
        }
        
        // Process values with normalization if needed
        let values = [];
        
        result.features.forEach(f => {
          const val = f.attributes[field];
          const stateName = f.attributes.NAME;
          
          if (val !== null) {
            if (shouldNormalize && popMap[stateName]) {
              const normalizedVal = (val / popMap[stateName]) * 100000;
              values.push(normalizedVal);
            } else {
              values.push(val);
              if (shouldNormalize) {
                console.log(`No population data for: ${stateName}`);
              }
            }
          }
        });
        
        if (values.length === 0) {
          console.warn("No valid values to display after normalization");
          return;
        }
    
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
    
        // Create a JSON string of the population data to use in expressions
        const popMapJSON = JSON.stringify(popMap);
        const popSourceMapJSON = JSON.stringify(popSourceMap);
        
        // Create a pretty label for each population source field
        const sourceLabels = {
          "Combined_Pop": "Combined Population",
          "Prison_population": "Prison Population",
          "Jail_Population__Adjusted_": "Jail Population (Adjusted)"
        };
        const sourceLabelsJSON = JSON.stringify(sourceLabels);
    
        // Update renderer
        if (shouldNormalize) {
          // Replace the current renderer with this:
          layer.renderer = {
            type: "simple",
            symbol: { type: "simple-fill", color: "#AAAAAA" },
            visualVariables: [{
              type: "color",
              valueExpression: `
                var stateName = $feature.NAME;
                var value = $feature["${field}"];
                
                // Use our pre-computed population map
                var popMap = ${popMapJSON};
                var pop = popMap[stateName];
                
                // Return normalized value if we have population data
                if (pop > 0 && value != null) {
                  return (value / pop) * 100000;
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
        } else {
          // Standard renderer without normalization
          layer.renderer = {
            type: "class-breaks",
            field: field,
            classBreakInfos: classBreakInfos.map(info => ({
              minValue: info.minValue,
              maxValue: info.maxValue,
              symbol: { type: "simple-fill", color: info.color }
            }))
          };
        }
        
        // Update popup template
        const fieldLabel = field.replace(/_/g, " ");
        
        if (shouldNormalize) {
          layer.popupTemplate = {
            title: "{NAME}",
            content: `
              <b>${fieldLabel}:</b> {${field}}<br>
              <b>Population Data Source:</b> {expression/populationSource}<br>
              <b>Population Value:</b> {expression/population}<br>
              <b>Rate per 100,000:</b> {expression/normalizedRate}
            `,
            expressionInfos: [
              {
                name: "normalizedRate",
                expression: `
                  var value = $feature["${field}"];
                  var stateName = $feature.NAME;
                  
                  // Get population from our lookup
                  var popMap = ${popMapJSON};
                  var pop = popMap[stateName];
                  
                  if (pop > 0 && value != null) {
                    return Text.FormatNumber((value / pop) * 100000, "#,##0.00");
                  }
                  return "No population data";
                `
              },
              {
                name: "population",
                expression: `
                  var stateName = $feature.NAME;
                  
                  // Get population from our lookup
                  var popMap = ${popMapJSON};
                  var pop = popMap[stateName];
                  
                  if (pop > 0) {
                    return Text.FormatNumber(pop, "#,##0");
                  }
                  return "No data";
                `
              },
              {
                name: "populationSource",
                expression: `
                  var stateName = $feature.NAME;
                  
                  // Get the source field that was used
                  var sourceMap = ${popSourceMapJSON};
                  var source = sourceMap[stateName];
                  
                  if (source) {
                    // Convert to a friendly name
                    var labels = ${sourceLabelsJSON};
                    return labels[source] || source;
                  }
                  
                  return "None (Data Unavailable)";
                `
              }
            ]
          };
        } else {
          layer.popupTemplate = {
            title: "{NAME}",
            content: `<b>${fieldLabel}:</b> {${field}}`
          };
        }
        
        // Update legend title to indicate normalization
        const legendTitle = shouldNormalize ? 
          `${fieldLabel} (Rate per 100,000)` : 
          fieldLabel;
          
        updateLegend2(classBreakInfos, legendTitle);
      }).catch(error => console.error("Queries failed:", error));
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
