document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const SPREADSHEET_ID = '1vhdAs7Bcz0tU9tIxp44U_XmYMegx2msyKGxK6lWDrwg';
    // IMPORTANT: Replace this with the Web app URL you got after deploying the Apps Script
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4SY1czzSACtv8_x0gv4WOYKOuD1jHZ1Lvv3jGQ--sj9vBRdSgb_qBunfGgpGlcbn5/exec'; // Your previously provided URL

    // --- DOM Elements ---
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

    // --- Global State ---
    let allWords = [];
    let currentFilteredList = [];
    let currentWord = null;
    let currentListType = ''; // 'daily', 'tooEasy', 'toLearn'
    let speechSynthVoices = [];

    // --- Utility Functions ---
    function showLoading(show) {
        if (loadingSpinner) {
            loadingSpinner.classList.toggle('hidden', !show);
        }
    }

    function getToneHtml(toneSymbol) {
        let pictogram = toneSymbol;
        let cssClass = '';
        switch (toneSymbol) {
            case '─': pictogram = '▬'; cssClass = 'tone-1'; break;
            case '↗': pictogram = '⬆️'; cssClass = 'tone-2'; break;
            case '͝': pictogram = '✓'; cssClass = 'tone-3'; break;
            case '↘': pictogram = '⬇️'; cssClass = 'tone-4'; break;
            default: cssClass = 'tone-neutral'; break;
        }
        return `<span class="${cssClass}">${pictogram}</span>`;
    }

    function showPage(pageId) {
        if (welcomePage) welcomePage.classList.remove('active');
        if (flashcardPage) flashcardPage.classList.remove('active');
        const pageToShow = document.getElementById(pageId);
        if (pageToShow) {
            pageToShow.classList.add('active');
        } else {
            console.error("Page not found:", pageId);
        }
    }

    // --- Core Logic ---
    async function fetchSpreadsheetData() {
        console.log("Attempting to fetch spreadsheet data...");
        showLoading(true);
        try {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&t=${new Date().getTime()}`; // Added cache buster
            console.log("Fetching from URL:", gvizUrl);
            const response = await fetch(gvizUrl);

            if (!response.ok) {
                console.error("Network response was not ok for gviz fetch:", response.status, response.statusText);
                throw new Error(`Failed to fetch spreadsheet data: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log("gviz response text:", text.substring(0, 100) + "..."); // Log snippet of response

            const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
            const parsedData = JSON.parse(jsonString);
            console.log("Parsed gviz data:", parsedData);

            if (!parsedData.table || !parsedData.table.rows) {
                console.error("Error: Unexpected data structure from Google Sheets API.", parsedData);
                alert("Failed to load words. The spreadsheet data might be malformed.");
                allWords = []; // Ensure allWords is empty if fetch fails structurally
            } else {
                allWords = parsedData.table.rows.map((row, index) => {
                    if (!row || !row.c || !Array.isArray(row.c) || row.c.length < 6) {
                        console.warn(`Skipping malformed row at index ${index}:`, row);
                        return null;
                    }
                    return {
                        id: index,
                        chinese: row.c[0] ? row.c[0].v : '',
                        pinyin: row.c[1] ? row.c[1].v : '',
                        english: row.c[2] ? row.c[2].v : '',
                        tone: row.c[3] ? row.c[3].v : '',
                        tooEasy: row.c[4] && row.c[4].v === 1,
                        toLearn: row.c[5] && row.c[5].v === 1
                    };
                }).filter(word => word !== null && word.chinese);
            }

            if (wordCountEl) {
                wordCountEl.textContent = allWords.length;
            }
            console.log("Processed words count:", allWords.length);

        } catch (error) {
            console.error("Error in fetchSpreadsheetData:", error);
            alert("Could not load words. Please check the console for more details and verify your internet connection or the spreadsheet link.");
            allWords = []; // Ensure allWords is empty on error
            if (wordCountEl) wordCountEl.textContent = 'Error';
        } finally {
            showLoading(false);
        }
    }

    function filterWords() {
        if (!allWords) { // Should not happen if initialized properly
            console.error("allWords is not initialized!");
            currentFilteredList = [];
            return;
        }
        if (currentListType === 'daily') {
            currentFilteredList = allWords.filter(word => !word.tooEasy && !word.toLearn);
        } else if (currentListType === 'tooEasy') {
            currentFilteredList = allWords.filter(word => word.tooEasy);
        } else if (currentListType === 'toLearn') {
            currentFilteredList = allWords.filter(word => word.toLearn);
        } else {
            currentFilteredList = []; // Default to empty if type is unknown
        }
    }

    function displayRandomWord() {
        filterWords();
        if (!currentWord && currentFilteredList.length === 0) { // Only show no words if it wasn't already on a card
             if (charDisplay) charDisplay.textContent = '🎉';
             if (toneDisplay) toneDisplay.innerHTML = '';
             if (noWordsMessage) noWordsMessage.style.display = 'block';
             if (flashcardFront) flashcardFront.style.display = 'flex';
             const frontActions = document.getElementById('flashcard-front')?.querySelector('.flashcard-actions');
             if (frontActions) frontActions.style.display = 'none';
             if (flashcardBack) flashcardBack.style.display = 'none';
             currentWord = null;
             return;
        } else if (currentFilteredList.length === 0) { // If list becomes empty while on a card
            // Stay on current card or decide behavior
            // For now, just indicate no more words in this list if they hit next
             if (charDisplay) charDisplay.textContent = '🎉';
             if (toneDisplay) toneDisplay.innerHTML = '';
             if (noWordsMessage) noWordsMessage.style.display = 'block';
             const frontActions = document.getElementById('flashcard-front')?.querySelector('.flashcard-actions');
             if (frontActions) frontActions.style.display = 'none';
             currentWord = null; // No more words to pick
             return;
        }


        if (noWordsMessage) noWordsMessage.style.display = 'none';
        const frontActions = document.getElementById('flashcard-front')?.querySelector('.flashcard-actions');
        if (frontActions) frontActions.style.display = 'flex';

        const randomIndex = Math.floor(Math.random() * currentFilteredList.length);
        currentWord = currentFilteredList[randomIndex];

        if (charDisplay) charDisplay.textContent = currentWord.chinese;
        if (toneDisplay) toneDisplay.innerHTML = getToneHtml(currentWord.tone);

        if (flashcardFront) flashcardFront.style.display = 'flex';
        if (flashcardBack) flashcardBack.style.display = 'none';
    }

    function renderBackButtons() {
        if (!flashcardBackActions || !currentWord) return;
        flashcardBackActions.innerHTML = '';

        const listenBtn = document.createElement('button');
        listenBtn.textContent = 'LISTEN 🔊';
        listenBtn.classList.add('action-button', 'listen');
        listenBtn.addEventListener('click', () => {
            if (currentWord && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(currentWord.chinese);
                utterance.lang = 'zh-CN';
                if (speechSynthVoices.length > 0) {
                    let chineseVoice = speechSynthVoices.find(voice => voice.lang === 'zh-CN' || voice.lang.startsWith('zh-'));
                    if (chineseVoice) utterance.voice = chineseVoice;
                }
                speechSynthesis.cancel();
                speechSynthesis.speak(utterance);
            } else {
                alert('Sorry, Text-to-Speech is not supported or no word selected.');
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

    async function updateWordStatus(wordToUpdate, column, value) {
        if (!wordToUpdate) {
            console.error("updateWordStatus called with no word.");
            return;
        }
        console.log(`Attempting to update char: "${wordToUpdate.chinese}", column: ${column}, value: ${value} via URL: ${APPS_SCRIPT_URL}`);

        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || !APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
            alert("Developer: Please configure a valid APPS_SCRIPT_URL in script.js to enable sheet updates.");
            const wordInAll = allWords.find(w => w.id === wordToUpdate.id); // Use ID for safer update
            if (wordInAll) {
                if (column === 'E') wordInAll.tooEasy = (value === 1);
                if (column === 'F') wordInAll.toLearn = (value === 1);
            }
            displayRandomWord();
            return;
        }

        showLoading(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    char: wordToUpdate.chinese,
                    column: column,
                    value: value
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error updating sheet (HTTP ${response.status}):`, errorText);
                throw new Error(`Sheet update failed with status ${response.status}. Response: ${errorText}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log("Sheet updated successfully via Apps Script:", result);
                const wordInAll = allWords.find(w => w.id === wordToUpdate.id); // Use ID
                if (wordInAll) {
                    if (column === 'E') wordInAll.tooEasy = (value === 1);
                    if (column === 'F') wordInAll.toLearn = (value === 1);
                }
            } else {
                console.error("Apps Script reported error:", result.message);
                throw new Error(`Apps Script error: ${result.message}`);
            }
        } catch (error) {
            console.error("Network error or other exception calling Apps Script:", error);
            alert(`Failed to save changes: ${error.message}. Please check console and ensure Apps Script is correctly deployed.`);
            // Do not automatically go to next word if update failed
            showLoading(false); // Ensure spinner is hidden on error
            return; // Stop here
        } finally {
            // Only hide spinner if not already hidden by an error return
            if (!loadingSpinner.classList.contains('hidden')) {
                 showLoading(false);
            }
        }
        displayRandomWord(); // Go to next word ONLY if successful or explicitly handled
    }


    // --- Event Handlers ---
    function handleNavButtonClick(listType) {
        currentListType = listType;
        showPage('flashcard-page');
        displayRandomWord();
    }

    function setupEventListeners() {
        if (dailyReviewBtn) dailyReviewBtn.addEventListener('click', () => handleNavButtonClick('daily'));
        if (tooEasyBtn) tooEasyBtn.addEventListener('click', () => handleNavButtonClick('tooEasy'));
        if (toLearnBtn) toLearnBtn.addEventListener('click', () => handleNavButtonClick('toLearn'));
        
        if (homeBtn) homeBtn.addEventListener('click', () => showPage('welcome-page')); // Re-show welcome, don't re-fetch unless necessary
        
        if (showAnswerBtn) {
            showAnswerBtn.addEventListener('click', () => {
                if (!currentWord) return;
                if (flashcardFront) flashcardFront.style.display = 'none';
                if (flashcardBack) flashcardBack.style.display = 'flex';
                if (charBackDisplay) charBackDisplay.textContent = currentWord.chinese;
                if (pinyinDisplay) pinyinDisplay.textContent = currentWord.pinyin;
                if (englishDisplay) englishDisplay.textContent = currentWord.english;
                renderBackButtons();
            });
        }
        if (nextWordBtnFront) nextWordBtnFront.addEventListener('click', displayRandomWord);
    }

    function loadSpeechVoices() {
        if ('speechSynthesis' in window) {
            speechSynthVoices = speechSynthesis.getVoices();
            if (speechSynthVoices.length === 0 && speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => {
                    speechSynthVoices = speechSynthesis.getVoices();
                    console.log("Voices loaded (onvoiceschanged):", speechSynthVoices.length);
                };
            } else {
                console.log("Voices loaded (initial):", speechSynthVoices.length);
            }
        }
    }

    // --- Initialization ---
    async function initializeApp() {
        console.log("Initializing app...");
        showLoading(true); // Show spinner at the very start
        setupEventListeners(); // Set up listeners early
        loadSpeechVoices();    // Attempt to load voices
        await fetchSpreadsheetData(); // Load data from sheet
        showPage('welcome-page');     // Show the welcome page
        // fetchSpreadsheetData will hide spinner in its finally block
        console.log("App initialized.");
    }

    // Start the application
    initializeApp().catch(error => {
        console.error("Critical error during app initialization:", error);
        alert("A critical error occurred while starting the app. Please check the console.");
        showLoading(false); // Ensure spinner is hidden if init fails catastrophically
    });

});