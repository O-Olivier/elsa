document.addEventListener('DOMContentLoaded', () => {
    const SPREADSHEET_ID = '1vhdAs7Bcz0tU9tIxp44U_XmYMegx2msyKGxK6lWDrwg';
    // IMPORTANT: Replace this with the Web app URL you got after deploying the Apps Script
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzghskRRyz4Ns_qxC1IURJctu3tarOpasM_R7cD07lM-Qavi-E1Nd01u4FRSjEkVOWu/exec';

    const welcomePage = document.getElementById('welcome-page');
    const flashcardPage = document.getElementById('flashcard-page');
    const wordCountEl = document.getElementById('word-count');
    const dailyReviewBtn = document.getElementById('daily-review-btn');
    const tooEasyBtn = document.getElementById('too-easy-btn');
    const toLearnBtn = document.getElementById('to-learn-btn');
    const homeBtn = document.getElementById('home-btn');

    const charDisplay = document.getElementById('char-display');
    const toneDisplay = document.getElementById('tone-display');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const nextWordBtnFront = document.getElementById('next-word-btn-front');

    const flashcardFront = document.getElementById('flashcard-front');
    const flashcardBack = document.getElementById('flashcard-back');
    const charBackDisplay = document.getElementById('char-back-display');
    const pinyinDisplay = document.getElementById('pinyin-display');
    const englishDisplay = document.getElementById('english-display');
    const flashcardBackActions = document.getElementById('flashcard-back-actions');
    const noWordsMessage = document.getElementById('no-words-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    let allWords = [];
    let currentFilteredList = [];
    let currentWord = null;
    let currentListType = ''; // 'daily', 'tooEasy', 'toLearn'

    // --- Data Fetching and Processing ---
    async function fetchSpreadsheetData() {
        loadingSpinner.classList.remove('hidden');
        try {
            // Using Google Sheets API with gviz to fetch public sheet data as JSON
            const response = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`);
            const text = await response.text();
            // The response is JSONP, need to extract the JSON part
            const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
            const parsedData = JSON.parse(jsonString);
            
            // console.log("Parsed Data:", parsedData); // For debugging

            if (!parsedData.table || !parsedData.table.rows) {
                console.error("Error: Unexpected data structure from Google Sheets API.", parsedData);
                alert("Failed to load words. The spreadsheet data might be malformed.");
                loadingSpinner.classList.add('hidden');
                return;
            }

            // Assuming first row is headers, if not, adjust c.slice(1)
            // Also, assuming your sheet does not have headers, or you want to include the first row.
            // If your sheet has headers and you want to skip them, use parsedData.table.rows.slice(1)
            allWords = parsedData.table.rows.map((row, index) => {
                 // Check if row.c exists and is an array, and has enough elements
                if (!row || !row.c || !Array.isArray(row.c) || row.c.length < 6) {
                    console.warn(`Skipping malformed row at index ${index}:`, row);
                    return null; // Skip this row
                }
                return {
                    id: index, // Keep original index for potential updates
                    chinese: row.c[0] ? row.c[0].v : '',
                    pinyin: row.c[1] ? row.c[1].v : '',
                    english: row.c[2] ? row.c[2].v : '',
                    tone: row.c[3] ? row.c[3].v : '',
                    tooEasy: row.c[4] && row.c[4].v === 1, // Column E (index 4)
                    toLearn: row.c[5] && row.c[5].v === 1  // Column F (index 5)
                };
            }).filter(word => word !== null && word.chinese); // Filter out nulls and words without Chinese char

            wordCountEl.textContent = allWords.length;
            // console.log("Fetched words:", allWords);

        } catch (error) {
            console.error("Error fetching spreadsheet data:", error);
            alert("Could not load words. Please check your internet connection or the spreadsheet link.");
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }

    // --- Tone Styling ---
    function getToneHtml(toneSymbol) {
        // ͝  is purple, ─ is green, ↘ is blue, ↗ is red
        // Using pictograms: ─ (1st), ↗ (2nd), ͝ (3rd V-shape), ↘ (4th)
        let pictogram = toneSymbol;
        let cssClass = '';
        switch (toneSymbol) {
            case '─': pictogram = '▬'; cssClass = 'tone-1'; break; // High flat
            case '↗': pictogram = '⬆️'; cssClass = 'tone-2'; break; // Rising
            case '͝': pictogram = '✓'; cssClass = 'tone-3'; break; // Falling-rising (using a check as a V-like shape)
            case '↘': pictogram = '⬇️'; cssClass = 'tone-4'; break; // Falling
            default: cssClass = 'tone-neutral'; break; // Neutral or unrecognized
        }
        return `<span class="${cssClass}">${pictogram}</span>`;
    }


    // --- UI Navigation ---
    function showPage(pageId) {
        welcomePage.classList.remove('active');
        flashcardPage.classList.remove('active');
        document.getElementById(pageId).classList.add('active');
    }

    function showWelcomePage() {
        showPage('welcome-page');
        // Optionally, re-fetch data if you think it might have changed
        // fetchSpreadsheetData(); // Or update count based on local changes
        wordCountEl.textContent = allWords.length;
    }

    function showFlashcardPage() {
        flashcardFront.style.display = 'flex';
        flashcardBack.style.display = 'none';
        showPage('flashcard-page');
    }

    // --- Flashcard Logic ---
    function filterWords() {
        if (currentListType === 'daily') {
            currentFilteredList = allWords.filter(word => !word.tooEasy && !word.toLearn);
        } else if (currentListType === 'tooEasy') {
            currentFilteredList = allWords.filter(word => word.tooEasy);
        } else if (currentListType === 'toLearn') {
            currentFilteredList = allWords.filter(word => word.toLearn);
        }
    }

    function displayRandomWord() {
        filterWords(); // Ensure list is up-to-date
        if (currentFilteredList.length === 0) {
            charDisplay.textContent = '🎉';
            toneDisplay.innerHTML = '';
            noWordsMessage.style.display = 'block';
            flashcardFront.style.display = 'flex'; // Show front
            document.getElementById('flashcard-front').querySelector('.flashcard-actions').style.display = 'none'; // Hide front buttons
            flashcardBack.style.display = 'none';
            currentWord = null;
            return;
        }

        noWordsMessage.style.display = 'none';
        document.getElementById('flashcard-front').querySelector('.flashcard-actions').style.display = 'flex'; // Show front buttons

        const randomIndex = Math.floor(Math.random() * currentFilteredList.length);
        currentWord = currentFilteredList[randomIndex];

        charDisplay.textContent = currentWord.chinese;
        toneDisplay.innerHTML = getToneHtml(currentWord.tone);

        // Reset to front of flashcard
        flashcardFront.style.display = 'flex';
        flashcardBack.style.display = 'none';
    }

    showAnswerBtn.addEventListener('click', () => {
        if (!currentWord) return;
        flashcardFront.style.display = 'none';
        flashcardBack.style.display = 'flex';

        charBackDisplay.textContent = currentWord.chinese;
        pinyinDisplay.textContent = currentWord.pinyin;
        englishDisplay.textContent = currentWord.english;

        renderBackButtons();
    });

    function renderBackButtons() {
        flashcardBackActions.innerHTML = ''; // Clear existing buttons

        const listenBtn = document.createElement('button');
        listenBtn.textContent = 'LISTEN 🔊';
        listenBtn.classList.add('action-button', 'listen');
        listenBtn.addEventListener('click', () => {
            if (currentWord && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(currentWord.chinese);
                utterance.lang = 'zh-CN';
                speechSynthesis.speak(utterance);
            } else {
                alert('Sorry, your browser does not support Text-to-Speech, or no word is selected.');
            }
        });
        flashcardBackActions.appendChild(listenBtn);

        if (currentListType === 'daily') {
            const markTooEasyBtn = document.createElement('button');
            markTooEasyBtn.textContent = 'TOO EASY 👍';
            markTooEasyBtn.classList.add('action-button', 'too-easy-action');
            markTooEasyBtn.addEventListener('click', () => updateWordStatus(currentWord, 'E', 1));
            flashcardBackActions.appendChild(markTooEasyBtn);

            const markToLearnBtn = document.createElement('button');
            markToLearnBtn.textContent = 'TO LEARN 🤔';
            markToLearnBtn.classList.add('action-button', 'to-learn-action');
            markToLearnBtn.addEventListener('click', () => updateWordStatus(currentWord, 'F', 1));
            flashcardBackActions.appendChild(markToLearnBtn);
        } else if (currentListType === 'tooEasy') {
            const markNotTooEasyBtn = document.createElement('button');
            markNotTooEasyBtn.textContent = 'NOT EASY 😬';
            markNotTooEasyBtn.classList.add('action-button', 'not-too-easy-action');
            markNotTooEasyBtn.addEventListener('click', () => updateWordStatus(currentWord, 'E', 0));
            flashcardBackActions.appendChild(markNotTooEasyBtn);
        } else if (currentListType === 'toLearn') {
            const markLearntBtn = document.createElement('button');
            markLearntBtn.textContent = 'LEARNT ✅';
            markLearntBtn.classList.add('action-button', 'learnt-action');
            markLearntBtn.addEventListener('click', () => updateWordStatus(currentWord, 'F', 0));
            flashcardBackActions.appendChild(markLearntBtn);
        }

        const nextWordBtnBack = document.createElement('button');
        nextWordBtnBack.textContent = 'NEXT WORD ➡️';
        nextWordBtnBack.classList.add('action-button', 'next-word-action');
        nextWordBtnBack.addEventListener('click', displayRandomWord);
        flashcardBackActions.appendChild(nextWordBtnBack);
    }
    
    async function updateWordStatus(word, column, value) {
        if (!word) return;
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
            alert("Developer: Please configure the APPS_SCRIPT_URL in script.js to enable sheet updates.");
            // Simulate local update if Apps Script URL is not set
            if (column === 'E') word.tooEasy = (value === 1);
            if (column === 'F') word.toLearn = (value === 1);
            console.log("Local update (Apps Script not configured):", word);
            displayRandomWord(); // Move to next word after action
            return;
        }

        loadingSpinner.classList.remove('hidden');
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors', // Required for cross-origin requests to Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    char: word.chinese, // Send Chinese char to identify the row
                    column: column,     // 'E' or 'F'
                    value: value        // 0 or 1
                }),
            });
            const result = await response.json();
            if (result.status === 'success') {
                console.log("Sheet updated:", result);
                // Update local data to match
                const wordInAllWords = allWords.find(w => w.chinese === word.chinese);
                if (wordInAllWords) {
                    if (column === 'E') wordInAllWords.tooEasy = (value === 1);
                    if (column === 'F') wordInAllWords.toLearn = (value === 1);
                }
            } else {
                console.error("Error updating sheet:", result.message);
                alert(`Failed to update sheet: ${result.message}. The change is not saved.`);
            }
        } catch (error) {
            console.error("Error calling Apps Script:", error);
            alert(`An error occurred while trying to save your change: ${error.message}.`);
        } finally {
            loadingSpinner.classList.add('hidden');
            displayRandomWord(); // Move to next word after action
        }
    }


    // --- Event Listeners ---
    dailyReviewBtn.addEventListener('click', () => {
        currentListType = 'daily';
        showFlashcardPage();
        displayRandomWord();
    });

    tooEasyBtn.addEventListener('click', () => {
        currentListType = 'tooEasy';
        showFlashcardPage();
        displayRandomWord();
    });

    toLearnBtn.addEventListener('click', () => {
        currentListType = 'toLearn';
        showFlashcardPage();
        displayRandomWord();
    });

    homeBtn.addEventListener('click', showWelcomePage);
    nextWordBtnFront.addEventListener('click', displayRandomWord);


    // --- Initial Load ---
    async function initializeApp() {
        await fetchSpreadsheetData();
        showWelcomePage(); // Show welcome page after data is loaded
    }

    initializeApp();
});