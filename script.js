// Google Apps Script (Code.gs)

// Function to handle preflight OPTIONS requests for CORS
function doOptions(e) {
  var response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.TEXT); // Or MimeType.JSON
  response.setContent("OK"); // Content doesn't really matter for OPTIONS

  // Set CORS headers
  // Allow requests from your specific GitHub Pages origin
  response.setHeader('Access-Control-Allow-Origin', 'https://o-olivier.github.io');
  // OR, for wider access during testing (less secure for production if you only want your site):
  // response.setHeader('Access-Control-Allow-Origin', '*');

  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); // Allow POST, GET, and OPTIONS
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow Content-Type header

  // Optional: if you use withCredentials
  // response.setHeader('Access-Control-Allow-Credentials', 'true');

  // Optional: Max age for preflight request to be cached by browser (in seconds)
  // response.setHeader('Access-Control-Max-Age', '3600');

  return response;
}

// Your existing doPost function
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1"); // Or your specific sheet name
  var data = sheet.getDataRange().getValues();
  var params;

  try {
    // It's safer to check if e.postData and e.postData.contents exist
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      // Log the event object if postData is missing
      console.error("doPost called without e.postData.contents. Event object:", JSON.stringify(e));
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid request: Missing post data." })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (parseError) {
    console.error("Error parsing JSON from e.postData.contents:", parseError, "Contents:", e.postData ? e.postData.contents : "undefined");
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid request: Malformed JSON." })).setMimeType(ContentService.MimeType.JSON);
  }


  var charToUpdate = params.char; // The Chinese character to find
  var columnToUpdate = params.column; // 'E' for TOO EASY, 'F' for TO LEARN
  var valueToSet = params.value; // 0 or 1

  var rowIndex = -1;
  // Start from 1 to skip header row if you have one
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == charToUpdate) { // Column A (index 0) for Chinese character
      rowIndex = i + 1; // Spreadsheet rows are 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    console.log("Character not found:", charToUpdate);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Character not found: " + charToUpdate })).setMimeType(ContentService.MimeType.JSON);
  }

  var columnIndex;
  if (columnToUpdate === 'E') {
    columnIndex = 5; // Column E
  } else if (columnToUpdate === 'F') {
    columnIndex = 6; // Column F
  } else {
    console.log("Invalid column specified:", columnToUpdate);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid column specified" })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    sheet.getRange(rowIndex, columnIndex).setValue(valueToSet);
    SpreadsheetApp.flush(); // Ensure changes are saved
    console.log("Success: Updated char", charToUpdate, "column", columnToUpdate, "value", valueToSet);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", char: charToUpdate, column: columnToUpdate, value: valueToSet })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Error setting value in sheet:", error.toString(), "Row:", rowIndex, "Col:", columnIndex, "Value:", valueToSet);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Sheet update error: " + error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}