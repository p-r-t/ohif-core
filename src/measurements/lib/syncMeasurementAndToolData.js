import cornerstoneTools from 'cornerstone-tools';
import log from '../../log';
import studyMetadataManager from '../../utils/studyMetadataManager';
import getImageIdForImagePath from './getImageIdForImagePath';
import MeasurementApi from '../classes/MeasurementApi';

export default function syncMeasurementAndToolData(measurement) {
  log.info('syncMeasurementAndToolData');

  const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();

  // Stop here if the metadata for the measurement's study is not loaded yet
  const { studyInstanceUid } = measurement;
  const metadata = studyMetadataManager.get(studyInstanceUid);
  if (!metadata) return;

  // Iterate each child tool if the current tool has children
  const toolType = measurement.toolType;
  const { tool } = MeasurementApi.getToolConfiguration(toolType);
  if (Array.isArray(tool.childTools)) {
    tool.childTools.forEach(childToolKey => {
      const childMeasurement = measurement[childToolKey];
      if (!childMeasurement) return;
      childMeasurement._id = measurement._id;
      childMeasurement.measurementNumber = measurement.measurementNumber;
      childMeasurement.lesionNamingNumber = measurement.lesionNamingNumber;

      syncMeasurementAndToolData(childMeasurement);
    });

    return;
  }

  const imageId = getImageIdForImagePath(measurement.imagePath);

  // If no tool state exists for this imageId, create an empty object to store it
  if (!toolState[imageId]) {
    toolState[imageId] = {};
  }

  const currentToolState = toolState[imageId][toolType];
  const toolData = currentToolState && currentToolState.data;

  // Check if we already have toolData for this imageId and toolType
  if (toolData && toolData.length) {
    // If we have toolData, we should search it for any data related to the current Measurement
    const toolData = toolState[imageId][toolType].data;

    // Create a flag so we know if we've successfully updated the Measurement in the toolData
    let alreadyExists = false;

    // Loop through the toolData to search for this Measurement
    toolData.forEach(tool => {
      // Break the loop if this isn't the Measurement we are looking for
      if (tool._id !== measurement._id) {
        return;
      }

      // If we have found the Measurement, set the flag to True
      alreadyExists = true;

      // Update the toolData from the Measurement data
      Object.assign(tool, measurement);

      // Force to repaint the measurement on image
      tool.invalidated = true;

      return false;
    });

    // If we have found the Measurement we intended to update, we can stop this function here
    if (alreadyExists === true) {
      return;
    }
  } else {
    // If no toolData exists for this toolType, create an empty array to hold some
    toolState[imageId][toolType] = {
      data: []
    };
  }

  // If we have reached this point, it means we haven't found the Measurement we are looking for
  // in the current toolData. This means we need to add it.

  // Add the MeasurementData into the toolData for this imageId
  toolState[imageId][toolType].data.push(measurement);

  cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(
    toolState
  );
}
