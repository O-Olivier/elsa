document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const SPREADSHEET_ID = '1vhdAs7Bcz0tU9tIxp44U_XmYMegx2msyKGxK6lWDrwg';
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
    let currentListType = '';
    let speechSynthVoices = [];
    let audioPrimed = false; // For audio unlock hack

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
    
    // --- Audio Unlock Attempt ---
    function primeAudio() {
        if (!audioPrimed && 'speechSynthesis' in window) {
            try {
                console.log("Attempting to prime audio context for speech synthesis...");
                const dummyUtterance = new SpeechSynthesisUtterance(' '); // Speak a space character
                dummyUtterance.volume = 0; // Make it silent
                dummyUtterance.lang = 'zh-CN'; // Set language to potentially help load voices
                speechSynthesis.speak(dummyUtterance);
                audioPrimed = true;
                console.log("Speech synthesis engine primed.");
                // Remove listeners after first successful priming
                document.body.removeEventListener('click', primeAudio, true);
                document.body.removeEventListener('touchend', primeAudio, true);
            } catch (e) {
                console.error("Error priming audio:", e);
                // If priming fails, still set audioPrimed to true to not retry indefinitely
                audioPrimed = true; 
            }
        }
    }


    // --- Core Logic ---
    async function fetchSpreadsheetData() {
        console.log("Attempting to fetch spreadsheet data...");
        showLoading(true);
        try {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&t=${new Date().getTime()}`;
            console.log("Fetching from URL:", gvizUrl);
            const response = await fetch(gvizUrl);

            if (!response.ok) {
                console.error("Network response was not ok for gviz fetch:", response.status, response.statusText);
                throw new Error(`Failed to fetch spreadsheet data: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
            const parsedData = JSON.parse(jsonString);

            if (!parsedData.table || !parsedData.table.rows) {
                console.error("Error: Unexpected data structure from Google Sheets API.", parsedData);
                allWords = [];
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
            alert("Could not load words. Please check the console for more details.");
            allWords = [];
            if (wordCountEl) wordCountEl.textContent = 'Error';
        } finally {
            showLoading(false);
        }
    }

    function filterWords() {
        if (!allWords) { 
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
            currentFilteredList = [];
        }
    }

    function displayRandomWord() {
        filterWords();
        if (currentFilteredList.length === 0) {
             if (charDisplay) charDisplay.textContent = '🎉';
             if (toneDisplay) toneDisplay.innerHTML = '';
             if (noWordsMessage) noWordsMessage.style.display = 'block';
             if (flashcardFront) flashcardFront.style.display = 'flex';
             const frontActions = document.getElementById('flashcard-front')?.querySelector('.flashcard-actions');
             if (frontActions) frontActions.style.display = 'none';
             if (flashcardBack) flashcardBack.style.display = 'none';
             currentWord = null;
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
                // Attempt to prime again if not already, or if speaking directly
                // Though ideally primeAudio was called on first body interaction
                if (!audioPrimed) primeAudio(); 

                console.log("Listen button clicked. Current word:", currentWord.chinese);
                const utterance = new SpeechSynthesisUtterance(currentWord.chinese);
                utterance.lang = 'zh-CN';
                if (speechSynthVoices.length > 0) {
                    let chineseVoice = speechSynthVoices.find(voice => voice.lang === 'zh-CN' || voice.lang.startsWith('zh-'));
                    if (chineseVoice) {
                        utterance.voice = chineseVoice;
                        console.log("Using voice:", chineseVoice.name);
                    } else {
                        console.log("No specific zh-CN voice found, using lang default.");
                    }
                } else {
                     console.warn("speechSynthVoices array is empty. Speech will rely on lang attribute only.");
                }
                
                utterance.onstart = () => console.log("Speech started for:", currentWord.chinese);
                utterance.onend = () => console.log("Speech ended for:", currentWord.chinese);
                utterance.onerror = (event) => console.error("SpeechSynthesisUtterance.onerror", event);

                speechSynthesis.cancel(); // Cancel any previous speech
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
        console.log(`Attempting to update char: "${wordToUpdate.chinese}", column: ${column}, value: ${value}`);

        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || !APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
            alert("Developer: Please configure a valid APPS_SCRIPT_URL in script.js.");
            // ... local update simulation ...
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
                throw new Error(`Sheet update failed with status ${response.status}.`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log("Sheet updated successfully via Apps Script:", result);
                const wordInAll = allWords.find(w => w.id === wordToUpdate.id);
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
            alert(`Failed to save changes: ${error.message}.`);
            showLoading(false);
            return; 
        } 
        // Only hide spinner and go to next word if successful
        showLoading(false);
        displayRandomWord(); 
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
        
        if (homeBtn) homeBtn.addEventListener('click', () => showPage('welcome-page'));
        
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

        // Add event listeners for the audio priming on first interaction
        document.body.addEventListener('click', primeAudio, { capture: true, once: true });
        document.body.addEventListener('touchend', primeAudio, { capture: true, once: true });
        console.log("Audio priming event listeners attached to body.");
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
        showLoading(true); 
        setupEventListeners(); 
        loadSpeechVoices();    
        await fetchSpreadsheetData(); 
        showPage('welcome-page');     
        console.log("App initialized.");
        // Spinner is hidden in fetchSpreadsheetData's finally block
    }

    initializeApp().catch(error => {
        console.error("Critical error during app initialization:", error);
        alert("A critical error occurred while starting the app. Please check the console.");
        showLoading(false); 
    });

});