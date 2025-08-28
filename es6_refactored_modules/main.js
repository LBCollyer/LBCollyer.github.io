
// main.js
// Initializes the application, loads ArcGIS modules, and coordinates all components.

import { my, loadVariableDescriptions, loadIndianaPopulation } from './dataLoader.js';
import { setupIntroDismissal } from './uiManager.js';
import { updateLegend2 } from './legendManager.js';

loadVariableDescriptions();
loadIndianaPopulation();
setupIntroDismissal();

// Additional initialization logic would go here...
