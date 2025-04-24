// Initialize global namespace object to store application variables
window.my = {};
my.varDesc = {}; // Will store variable descriptions from CSV

// Fetch variable descriptions from external CSV file
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

//parse Indiana population
fetch("Indiana Prison Population.csv")
  .then(response => response.text())
  .then(csv => {
    const lines = csv.split("\n").filter(line => line.trim() !== "");
    const headers = lines[0].split(",");
    const data = lines.slice(1);
    
    my.indianaPopMap = {};
    
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

// Load required ArcGIS modules
require([
  "esri/layers/FeatureLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/Color",
  "esri/views/navigation/Navigation"
], function(FeatureLayer, UniqueValueRenderer, SimpleMarkerSymbol, Color, Navigation) {
  // Initialize main application variables
  my.arcgisMap = document.querySelector("arcgis-map"); // Reference to the map element
  my.sYear = 2022; // Default selected year
  my.yearSlider = document.getElementById("yearSlider"); // Year selection slider
  my.sVar = "PVINM"; // Default selected variable
  my.selectVar = document.getElementById("varSelector"); // Variable selector dropdown
  my.sLay = "Facility_Types"; // Default selected layer
  // Initialize normalization setting
  my.shouldNormalize = document.getElementById("normalizeToggle")
  my.shouldNormalize.checked = true;
  
  // Set up intro page dismissal animation
  document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("intro").style.transform = "translateY(-100%)"; // Slide intro up
    setTimeout(() => {
      document.getElementById("intro").style.display = "none"; // Hide completely after animation
    }, 1000); 
  });

  // Initialize layer selector for legend 2
  my.layerNames = ["Facility_Types", "Race_Data", "Admissions", "HIV_Data", "Releases", 
                   "Citizenship_Data", "Death_Data", "Jurisdiction_and_Custody_Data", 
                   "Prison_and_Jail_Population_Data"];
  my.selectLayer = document.getElementById("layerSelector");
  
  // Populate layer selector with options
  my.layerNames.forEach(name => {
      const option = document.createElement("calcite-option");
      option.value = name;
      option.textContent = name.replace("_", " "); // Format for display
      my.selectLayer.appendChild(option);
  });
  
  /**
   * Updates the year slider range based on available data for the chosen variable
   * @param {FeatureLayer} layer - The active feature layer
   * @param {string} field - The selected data field
   */
  function updateYearSlider(layer, field) {
    // Find the year field name among possible options
    const potentialYearFields = ["Year", "YEAR", "year"];
    const yearField = potentialYearFields.find(f => 
      layer.fields.some(fieldInfo => fieldInfo.name === f)
    );
    
    // Set up query to find years with data
    const query = layer.createQuery();
    query.where = `${field} IS NOT NULL`; // Only years with data for selected field
    query.outFields = [yearField];
    query.returnGeometry = false; // No need for geometry data
  
    // Query the layer for years
    layer.queryFeatures(query).then(result => {
      const years = result.features
                          .map(f => f.attributes[yearField])
                          .filter(year => year != null);
      if (years.length > 0) {
        // Update slider with min/max years
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        my.yearSlider.min = minYear;
        my.yearSlider.max = maxYear;
        my.yearSlider.value = maxYear; // Default to most recent
        my.yearSlider.setAttribute("min-label", minYear);
        my.yearSlider.setAttribute("max-label", maxYear);
        my.sYear = maxYear;
      }
    }).catch(error => console.error("Year query failed:", error));
  }
  
  /**
   * Updates the second legend with choropleth classification breakpoints
   * @param {Array} classBreakInfos - Array of classification break information
   * @param {string} field - Field name for the legend title
   */
  function updateLegend2(classBreakInfos, field) {
    const legendPanel = document.getElementById("legendPanel2");
    legendPanel.innerHTML = ""; // Clear existing legend
    legendPanel.heading = `% individuals in ${field}`;
    const legendList = document.createElement("calcite-list");
    
    // Add grey box for "No Data" category
    let listItem1 = document.createElement("calcite-list-item");        
    // Create color box for visualization
    const colorBox1 = document.createElement("span");
    colorBox1.style.display = "inline-block";
    colorBox1.style.width = "16px";
    colorBox1.style.height = "16px";
    colorBox1.style.backgroundColor = "#AAAAAA";
    colorBox1.style.marginRight = "8px";
    colorBox1.style.border = "1px solid black";
    listItem1.innerHTML = `
      <div slot="content" style="display: flex; align-items: center;">
        ${colorBox1.outerHTML}
        <span>${"No Data"}</span>
      </div>
    `;
    legendList.appendChild(listItem1);
    
    // Add each class break to the legend
    classBreakInfos.forEach(info => {
      let listItem = document.createElement("calcite-list-item");        
      // Create color box for the class
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

  // Event listener for when the map view is ready
  my.arcgisMap.addEventListener("arcgisViewReadyChange", (event) => { 
    my.view = my.arcgisMap.view; // Store reference to the map view
    my.view.navigation.actionMap.mouseWheel= 'none'; // Disable mouse wheel zoom
    my.storyContainer = document.querySelector(".story-container");
    my.sections = document.querySelectorAll('.story-section');
    my.scrolled = false; // Flag to track initial scroll action
    
    // Set up wheel event to trigger initial view change
    document.addEventListener("wheel", (event) => {
      if (!my.scrolled) {
        // Zoom to Louisiana on first scroll
        const targetLatitude = 31.0667;
        const targetLongitude = -83.0000;
        my.view.goTo({
          center: [targetLongitude, targetLatitude],
          scale: 6000000  // Set initial zoom level
        }).then(() => {
          my.view.zoom = 7;
        });
        my.scrolled = true; // Prevent repeating this action
        my.storyContainer.style.display = "block"; // Show story container
        setTimeout(() => {
          my.storyContainer.style.opacity = "1"; // Fade in smoothly
        }, 100);
      }
    });
    
    // Set up intersection observer to detect when user reaches end of story
    my.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        console.log(entry.target, entry.isIntersecting);
        // Check if we're at the last section and it's fully visible
        if (entry.isIntersecting && entry.target === my.sections[my.sections.length - 1]) {
          // Hide story container
          my.storyContainer.style.opacity = "0";
          my.storyContainer.style.pointerEvents = "none"; // Disable interaction
          
          // Zoom out to national view
          my.view.goTo({
            center:[-96, 39], // Center of continental US
            scale: 20000000
          })
          my.corFacil.visible = false;
          
          // Switch from legend 1 to legend 2
          my.legend1 = document.querySelector("#legend1");
          my.legend1.style.opacity = "0";
          my.legend1.style.pointerEvents = "none";
          my.legend2 = document.querySelector("#legend2");
          my.legend2.style.display = "block";
          my.legend2.style.opacity = "1";
          document.getElementById("title").innerHTML = `
            <h2>National Prisoner Statistics Map (1978-2022)</h2>
            <p>Data from United States Bureau of Justice Statistics</p>
          `;
          // Initialize the UI with the default layer
          updateUI2("Facility_Types");
        }
      });
    }, { threshold: 1.0 }); // Trigger when last section is fully in view
    
    // Observe all story sections
    my.sections.forEach(section => my.observer.observe(section));
    
    /**
     * Returns a random color for symbology
     * @returns {Color} Random RGB color
     */
    function getRandomColor() {
      return new Color([Math.random() * 255, Math.random() * 255, Math.random() * 255]);
    }
    
    /**
     * Creates a unique value renderer for facility symbology
     * @param {string} field - Field to symbolize by
     * @param {Array} uniqueValues - Array of unique values and their colors
     * @returns {UniqueValueRenderer} Configured renderer
     */
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
    // Helper functions for choropleth rendering
    
    /**
     * Creates a lookup of population values by state
     * @param {Object} popResult - Query result with population data
     * @returns {Object} Maps with population data by state
     */
    function getPopulationLookup(popResult, year) {
      const popMap = {}, popSourceMap = {};
      const popFields = ["Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
      
      popResult.features.forEach(({ attributes }) => {
        const state = attributes.NAME;
        if (state == "Indiana") {
          const indianaData = my.indianaPopMap?.[year];
          if (indianaData) {
            const result = getMostCompleteSource(indianaData);
            popMap[state] = result.value;
            popSourceMap[state] = result.source;
          }
        } else {
          // Use the first valid population value found
          for (const field of popFields) {
            const val = attributes[field];
            if (val != null && val > 0) {
              popMap[state] = val;
              popSourceMap[state] = field; // Track which field was used
              break;
            }
          }
        }
      });
      return { popMap, popSourceMap };
    }
    
    function getMostCompleteSource(attrs) {
      // Return whichever source has a non-null value, prioritize Combined
      if (attrs["Combined_Pop"]) return { value: attrs["Combined_Pop"], source: "Combined_Pop" };
      if (attrs["Prison_population"]) return { value: attrs["Prison_population"], source: "Prison_population" };
      if (attrs["Jail_Population__Adjusted_"]) return { value: attrs["Jail_Population__Adjusted_"], source: "Jail_Population__Adjusted_" };
      return { value: null, source: null };
    }
    
    /**
     * Creates a normalized renderer for choropleth maps 
     * @param {string} field - Data field
     * @param {string} popMapJSON - JSON of population values by state
     * @param {number} min - Minimum data value
     * @param {number} max - Maximum data value
     * @param {number} step - Step size for classification
     * @returns {Object} Renderer configuration
     
    function getNormalizedRenderer(field, popMapJSON, valueMapJSON, min, max, step) {
      console.log(valueMapJSON);
      console.log(
      return {
        type: "simple",
        symbol: { type: "simple-fill", color: "#AAAAAA" },
        visualVariables: [{
          type: "color",
          // Arcade expression to normalize values by population
          valueExpression: `
              var stateName = $feature.NAME;
              var valueMap = ${valueMapJSON};
              var value = valueMap[stateName];
              
              if (value!=null) {
                return Text(value, "#,##0");
              }
              return "No data";
            `,
          // Color ramp for visualization
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
    }*/
    function getNormalizedRenderer(field, popMapJSON, valueMapJSON, min, max, step) {
      return {
        type: "simple",
        symbol: { type: "simple-fill", color: "#AAAAAA", outline: { width: 0.5, color: "white" } },
        visualVariables: [{
          type: "color",
          valueExpression: `
            var stateName = $feature.NAME;
            var valueMap = ${valueMapJSON};
            var value = valueMap[stateName];
    
            // Return as number for rendering (not text)
            if (value != null) {
              return value;
            }
            return null;
          `,
          stops: [
            { value: min, color: "#fef0d9" },
            { value: min + step, color: "#fdcc8a" },
            { value: min + 2 * step, color: "#fc8d59" },
            { value: min + 3 * step, color: "#e34a33" },
            { value: max, color: "#b30000" }
          ]
        }]
      };
    }

    
    /**
     * Creates a class breaks renderer for choropleth maps
     * @param {string} field - Data field
     * @param {Array} classBreakInfos - Class break information
     * @returns {Object} Renderer configuration
     */
    function getClassBreakRenderer(field, classBreakInfos) {
      return {
        type: "class-breaks",
        field,
        classBreakInfos: classBreakInfos.map(info => ({
          minValue: info.minValue,
          maxValue: info.maxValue,
          symbol: { type: "simple-fill", color: info.color }
        })),
        defaultSymbol: { 
          type: "simple-fill", 
          color: "#AAAAAA",  // Gray color for no data
          outline: { color: "#999999", width: 0.5 } 
        }
      };
    }
    
    /**
     * Creates a  template for normalized data
     * @param {string} field - Data field
     * @param {Object} values - Data values
     * @param {Object} popMap - Population values by state
     * @param {Object} popSourceMap - Population source by state
     * @returns {Object} Popup template configuration
     */
    function getNormalizedPopupTemplate(field, valueMapJSON, popMapJSON, popSourceMapJSON, sourceLabelsJSON) {
      const fieldLabel = field.replace(/_/g, " ");
      return {
        title: "{NAME} in {Year}",
        content: `
          <b>${fieldLabel} Total Number:</b> {${field}}<br>
          <b>Population Data Source:</b> {expression/populationSource}<br>
          <b>Total Number of Incarcerated Individuals:</b> {expression/population}<br>
          <b>Percentage of Incarcerated Individuals counted in ${fieldLabel}:</b> {expression/normalizedRate}
        `,
        // Expressions to calculate values for the popup
        expressionInfos: [
          {
            name: "normalizedRate",
            expression: `
              var stateName = $feature.NAME;
              var valueMap = ${valueMapJSON};
              var value = valueMap[stateName];
              
              if (value > 0) {
                return Text(value, "#,##0");
              }
              return "No data";
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
              var popSourceMap = ${popSourceMapJSON};
              var labels = ${sourceLabelsJSON};
              var source = popSourceMap[stateName];
              
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
    /**
     * Apply choropleth symbology to a layer based on data field and year
     * @param {FeatureLayer} layer - Layer to apply symbology to
     * @param {string} field - Data field
     * @param {number} year - Year for filtering data
     */
    async function applyChoroplethSymbology(layer, field, year) {
      // Determine which field holds year data
      const yearField = layer.name === "Layer 9" ? "Year" : "YEAR";
      layer.definitionExpression = `${yearField} = ${year}`;
      const fieldLabel = field.replace(/_/g, " ");
    
      // Check if we should normalize by population
      // Don't normalize if the field is already a population field
      const shouldNormalize = my.shouldNormalize &&
        !["Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"].includes(field);
    
      // Main query for the display layer
      const query = layer.createQuery();
      query.where = `${yearField} = ${year}`; // Filter by year 
      query.outFields = ["NAME", field]; // Only get needed fields
      query.returnGeometry = false; // No need for geometry
      
      // Optional query for population data if normalizing
      let popMap = {}, popSourceMap = {};
      if (shouldNormalize) {
        const popLayer = my.lays["Layer 9"]; // Population data layer
        const popQuery = popLayer.createQuery();
        popQuery.where = `Year = ${year}`;
        popQuery.outFields = ["NAME", "Combined_Pop", "Prison_population", "Jail_Population__Adjusted_"];
        popQuery.returnGeometry = false;
    
        try {
          const popResult = await popLayer.queryFeatures(popQuery);
          ({ popMap, popSourceMap } = getPopulationLookup(popResult, year));
        } catch (err) {
          console.error("Failed to load population data", err);
        }
      }
    
      try {
        // Query the main data
        const result = await layer.queryFeatures(query);
    
        let valueMap = {};
        //let popSourceMap = {};
        let classValues = [];
        
        // Process features to get normalized or raw values
        result.features.forEach(f => {
          const val = f.attributes[field];
          const state = f.attributes.NAME;
        
          if (val != null) {
            if (shouldNormalize) {
              if (!popMap[state]) {
                // No population data available
                valueMap[state] = null;
                classValues.push(null);
              } else {
                // Calculate normalized values
                const normalizedVal = (val / popMap[state]) * 100;
                valueMap[state] = normalizedVal;
                classValues.push(normalizedVal);
              }
            } else {
              // Use raw values
              valueMap[state] = val;
              classValues.push(val);
            }
          }
        });
        
        // Calculate classification breaks
        const min = Math.min(...classValues);
        const max = Math.max(...classValues);
        const step = (max - min) / 5;
    
        // Define classification breaks and colors
        const classBreakInfos = [
          { minValue: min, maxValue: min + step, color: "#fef0d9" },
          { minValue: min + step, maxValue: min + 2 * step, color: "#fdcc8a" },
          { minValue: min + 2 * step, maxValue: min + 3 * step, color: "#fc8d59" },
          { minValue: min + 3 * step, maxValue: min + 4 * step, color: "#e34a33" },
          { minValue: min + 4 * step, maxValue: max, color: "#b30000" }
        ];
        
        // Convert maps to JSON for use in Arcade expressions
        const valueMapJSON = JSON.stringify(valueMap);
        const popMapJSON = JSON.stringify(popMap);
        const popSourceMapJSON = JSON.stringify(popSourceMap);
        const sourceLabelsJSON = JSON.stringify({
          "Combined_Pop": "Combined Population",
          "Prison_population": "Prison Population",
          "Jail_Population__Adjusted_": "Jail Population (Adjusted)"
        });
    
        // Update layer renderer based on normalization setting
        layer.renderer = getNormalizedRenderer(field, popMapJSON, valueMapJSON, min, max, step);
        /*layer.renderer = shouldNormalize
          ? getNormalizedRenderer(field, popMapJSON, valueMapJSON, min, max, step)
          : getClassBreakRenderer(field, classBreakInfos);*/
    
        // Update popup template based on normalization setting
        layer.popupTemplate = shouldNormalize
          ? getNormalizedPopupTemplate(field, valueMapJSON, popMapJSON, popSourceMapJSON, sourceLabelsJSON)
          : {
              title: "{NAME} {Year}",
              content: `<b>${fieldLabel}:</b> {${field}}`
            };
    
        // Update legend with class breaks
        updateLegend2(classBreakInfos, fieldLabel);
      } catch (err) {
        console.error("Queries failed:", err);
      }
    }

    //---------------------------------------------------------------------------------------------------
    /**
     * Update UI when a new layer is selected
     * @param {string} chosenLayer - Name of the layer to display
     */
    function updateUI2(chosenLayer) {
      // Convert layer name to internal layer ID
      my.layerName = "Layer " + (my.layerNames.indexOf(chosenLayer) + 1);
      
      // Hide all layers and show only the selected one
      Object.values(my.lays).forEach(layer => layer.visible = false);
      my.lays[my.layerName].visible = true;
      
      // Get all field names from the layer
      my.fieldNames = my.lays[my.layerName].fields.map(field => field.name);
      
      // Define fields to exclude from dropdown (metadata fields)
      const excludedFields = new Set([
          "STATEFP", "STATENS", "GEOIDFQ", "GEOID", "STUSPS",
          "LSAD", "ALAND", "AWATER", "OBJECTID", "STATEID",
          "Shape__Length", "Shape__Area", "NAME", "YEAR", "OBJECTID_1", "STATE", "State", "Year", "REGION"
      ]);
      
      // Filter field names to only include data fields
      const filteredFields = my.fieldNames.filter(name => !excludedFields.has(name));
      
      // Clear and populate the variable selector dropdown
      my.selectVar = document.getElementById("varSelector");
      my.selectVar.innerHTML = "";
      filteredFields.forEach(name => {
          const option = document.createElement("calcite-option");
          option.value = name;
          option.textContent = name;
          my.selectVar.appendChild(option);
      })
      
      // Set default selection if available
      if (filteredFields.length > 0) {
        my.selectVar.value = filteredFields[0];
      }
      
      // Update current selections
      my.sVar = my.selectVar.value || my.fieldNames[0];
      if (my.yearSlider.value) {my.sYear = my.yearSlider.value;}
      document.getElementById("varDescription").textContent = my.fullName[my.sVar] || "No full name available.";
      document.getElementById("descToolTip").textContent = my.varDesc[my.sVar] || "No description available.";
      
      // Update the year slider based on available data
      updateYearSlider(my.lays[my.layerName], my.sVar);
      
      // Apply choropleth symbology with current settings
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    }
      
    /**
     * Update the legend for correctional facilities
     * @param {Array} uniqueValueInfos - Array of value info objects
     */
    function updateLegend(uniqueValueInfos) {
      const legendPanel = document.getElementById("legendPanel");
      legendPanel.innerHTML = ""; // Clear existing legend

      const legendList = document.createElement("calcite-list");
      legendList.layout = "inline";
      legendList.selectionMode = "none";

      // Add each value to the legend
      uniqueValueInfos.forEach(info => {
        const listItem = document.createElement("calcite-list-item");

        // Create color box for the value
        const colorBox = document.createElement("span");
        colorBox.style.display = "inline-block";
        colorBox.style.width = "16px";
        colorBox.style.height = "16px";
        colorBox.style.backgroundColor = info.color.toHex();
        colorBox.style.marginRight = "8px";
        colorBox.style.border = "1px solid black";

        // Append list item content with color and label
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
      outFields: ["*"] // Get all fields for flexibility
    });
    
    /**
     * Update the symbology of correctional facilities layer
     * @param {string} field - Field to symbolize by
     */
    function updateSymbology(field) {
      // Create query to get unique values for the field
      let query = my.corFacil.createQuery();
      query.returnDistinctValues = true;
      query.returnGeometry = false;
      query.outFields = [field];
      
      // Execute query and update symbology
      my.corFacil.queryFeatures(query).then(result => {
        // Get all unique values for the field
        let values = result.features.map(f => f.attributes[field]);
        let uniqueValues = values.filter((value, index, self) => self.indexOf(value) === index);
        
        // Assign random colors to each unique value
        let uniqueValueInfos = uniqueValues.map(value => ({
          value,
          color: getRandomColor()
        }));
        
        // Set renderer and update legend
        my.corFacil.renderer = createRenderer(field, uniqueValueInfos);
        updateLegend(uniqueValueInfos);
      }).catch(error => console.error("Query failed:", error));
    }

    // Initialize symbology with default field
    updateSymbology("Facil_Type");

    // Event listener for changing facility symbolization field
    document.getElementById("symbolFieldSelector").addEventListener("calciteSelectChange", (event) => {
      updateSymbology(event.target.value);
    });

    //Event listeners for choropleth map
    // Event listener for changing data layer
    document.getElementById("layerSelector").addEventListener("calciteSelectChange", (event) => {
      updateUI2(event.target.value);
    });
    
    // Event listener for changing data variable
    document.getElementById("varSelector").addEventListener("calciteSelectChange", (event) => {
      my.sVar = event.target.value;
      // Update the year slider range for this variable
      updateYearSlider(my.lays[my.layerName], my.sVar);
      if (my.yearSlider.value) { my.sYear = my.yearSlider.value; }
      // Update map symbology
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
      // Update variable description
      document.getElementById("varDescription").textContent = my.fullName[my.sVar] || "No full name available.";
      document.getElementById("descToolTip").textContent = my.varDesc[my.sVar] || "No description available.";
    });

    // Event listener for year slider changes
    document.getElementById("yearSlider").addEventListener("calciteSliderInput", (event) => {
        my.sYear = event.target.value;
        if (my.selectVar.value) { my.sVar = my.selectVar.value; }
        applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });
    
    // Event listener for normalization toggle
    document.getElementById("normalizeToggle").addEventListener("calciteSwitchChange", (event) => {
      my.shouldNormalize = event.target.checked;
      if (my.selectVar.value) { my.sVar = my.selectVar.value; }
      if (my.yearSlider.value) { my.sYear = my.yearSlider.value; }
      applyChoroplethSymbology(my.lays[my.layerName], my.sVar, my.sYear);
    });
    
    // Add base layers for context
    const baseURL = "https://services.arcgis.com/FvF9MZKp3JWPrSkg/arcgis/rest/services/Prison_Map/FeatureServer/";
    const baseLayers = [34, 10]; // Layer IDs for base layers
    baseLayers.forEach(id => {
      my.arcgisMap.addLayer(new FeatureLayer({
        url: `${baseURL}${id}`,
        outFields: ["*"]
      }));
    });
    
    // Add data layers (1 to 9)
    my.lays = {};
    for (let i = 1; i < 10; i++) {
      my.lays[`Layer ${i}`] = new FeatureLayer({
        url: `${baseURL}${i}`,
        outFields: ["*"],
        popupTemplate:{
          title: "{NAME}" // Simple popup showing state name
        }
      })
      my.arcgisMap.addLayer(my.lays[`Layer ${i}`]);
      my.lays[`Layer ${i}`].visible = false; // Hide initially
    }

    // Add correctional facilities layer last so it's on top
    my.arcgisMap.addLayer(my.corFacil);
    
    // Remove default basemap since I'm using my own layers
    my.arcgisMap.basemap = null;
  });
});
