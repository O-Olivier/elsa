// script.js
document.addEventListener('DOMContentLoaded', () => {
    const SPREADSHEET_ID = '1vhdAs7Bcz0tU9tIxp44U_XmYMegx2msyKGxK6lWDrwg';
    // IMPORTANT: Use your LATEST successfully tested Apps Script Web App URL
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4SY1czzSACtv8_x0gv4WOYKOuD1jHZ1Lvv3jGQ--sj9vBRdSgb_qBunfGgpGlcbn5/exec'; // REPLACE IF YOU HAVE A NEWER ONE

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
    let currentListType = '';
    let speechSynthVoices = [];

    function loadVoices() {
        if ('speechSynthesis' in window) {
            speechSynthVoices = speechSynthesis.getVoices();
            if (speechSynthVoices.length === 0 && speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => {
                    speechSynthVoices = speechSynthesis.getVoices();
                    console.log("Voices loaded (onvoiceschanged):", speechSynthVoices.length > 0 ? speechSynthVoices : "Still no voices, check browser/OS settings.");
                };
            } else if (speechSynthVoices.length > 0) {
                console.log("Voices loaded (initial):", speechSynthVoices);
            } else {
                console.log("Speech synthesis available, but no voices loaded initially and onvoiceschanged might not be supported or fired yet.");
            }
        } else {
            console.log("Speech synthesis not supported by this browser.");
        }
    }
    loadVoices();

    async function fetchSpreadsheetData() {
        loadingSpinner.classList.remove('hidden');
        try {
            const response = await fetch(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`);
            const text = await response.text();
            const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
            const parsedData = JSON.parse(jsonString);
            
            if (!parsedData.table || !parsedData.table.rows) {
                console.error("Error: Unexpected data structure from Google Sheets API.", parsedData);
                alert("Failed to load words. The spreadsheet data might be malformed.");
                return; // Keep spinner if error
            }

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

            wordCountEl.textContent = allWords.length;

        } catch (error) {
            console.error("Error fetching spreadsheet data:", error);
            alert("Could not load words. Please check your internet connection or the spreadsheet link.");
        } finally {
            loadingSpinner.classList.add('hidden');
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
            default: cssClass = 'tone-neutral'; pictogram = ''; break; 
        }
        return `<span class="${cssClass}">${pictogram}</span>`;
    }

    function showPage(pageId) {
        welcomePage.classList.remove('active');
        flashcardPage.classList.remove('active');
        document.getElementById(pageId).classList.add('active');
    }

    function showWelcomePage() {
        showPage('welcome-page');
        wordCountEl.textContent = allWords.length;
    }

    function showFlashcardPage() {
        flashcardFront.style.display = 'flex';
        flashcardBack.style.display = 'none';
        showPage('flashcard-page');
    }

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
        filterWords(); 
        if (currentFilteredList.length === 0) {
            charDisplay.textContent = '🎉';
            toneDisplay.innerHTML = '';
            noWordsMessage.style.display = 'block';
            flashcardFront.style.display = 'flex'; 
            const frontActions = document.getElementById('flashcard-front').querySelector('.flashcard-actions');
            if (frontActions) frontActions.style.display = 'none'; 
            flashcardBack.style.display = 'none';
            currentWord = null;
            return;
        }

        noWordsMessage.style.display = 'none';
        const frontActions = document.getElementById('flashcard-front').querySelector('.flashcard-actions');
        if (frontActions) frontActions.style.display = 'flex'; 

        const randomIndex = Math.floor(Math.random() * currentFilteredList.length);
        currentWord = currentFilteredList[randomIndex];

        charDisplay.textContent = currentWord.chinese;
        toneDisplay.innerHTML = getToneHtml(currentWord.tone);

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
        flashcardBackActions.innerHTML = ''; 

        const listenBtn = document.createElement('button');
        listenBtn.textContent = 'LISTEN 🔊';
        listenBtn.classList.add('action-button', 'listen');
        listenBtn.addEventListener('click', () => {
            if (currentWord && 'speechSynthesis' in window) {
                // Ensure voices are loaded if possible, especially on mobile click
                if (speechSynthVoices.length === 0 && speechSynthesis.getVoices().length > 0) {
                    speechSynthVoices = speechSynthesis.getVoices();
                    console.log("Voices re-fetched on click:", speechSynthVoices);
                }

                const utterance = new SpeechSynthesisUtterance(currentWord.chinese);
                utterance.lang = 'zh-CN'; 

                if (speechSynthVoices.length > 0) {
                    let chineseVoice = speechSynthVoices.find(voice => voice.lang === 'zh-CN' || voice.lang.startsWith('zh-'));
                    if (chineseVoice) {
                        utterance.voice = chineseVoice;
                        console.log("Using voice:", chineseVoice.name, chineseVoice.lang);
                    } else {
                        console.log("No specific zh-CN voice found from list. Using lang default. Available:", speechSynthVoices.map(v => ({name: v.name, lang: v.lang})));
                    }
                } else {
                    console.warn("speechSynthVoices array is empty or not populated. Speech relies on lang attribute only.");
                }
                
                speechSynthesis.cancel(); 
                speechSynthesis.speak(utterance);

                utterance.onstart = () => console.log("Speech started for:", currentWord.chinese);
                utterance.onend = () => console.log("Speech ended for:", currentWord.chinese);
                utterance.onerror = (event) => console.error("SpeechSynthesisUtterance.onerror", event);

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
        if (!word) {
            console.error("updateWordStatus called with no currentWord.");
            return;
        }
        if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || !APPS_SCRIPT_URL.startsWith('https://script.google.com/')) {
            alert("Developer: Please configure a valid APPS_SCRIPT_URL in script.js to enable sheet updates.");
            // Simulate local update for testing without configured URL
            const wordInAllWords = allWords.find(w => w.id === word.id); // Use ID for safer update
            if (wordInAllWords) {
                 if (column === 'E') wordInAllWords.tooEasy = (value === 1);
                 if (column === 'F') wordInAllWords.toLearn = (value === 1);
                 console.log("Local update (Apps Script not configured/invalid):", wordInAllWords);
            } else {
                console.error("Word not found in allWords for local update:", word);
            }
            displayRandomWord(); 
            return;
        }

        loadingSpinner.classList.remove('hidden');
        console.log(`Attempting to update char: "${word.chinese}", column: ${column}, value: ${value} via URL: ${APPS_SCRIPT_URL}`);

        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors', 
                headers: {
                    'Content-Type': 'application/json', // Ensuring this header is present
                },
                body: JSON.stringify({ // This is correct
                    char: word.chinese, 
                    column: column,     
                    value: value        
                }),
            });
            
            const responseText = await response.text(); // Get raw response text for logging
            console.log("Raw response from Apps Script:", responseText);
            console.log("Response status:", response.status);
            console.log("Response ok:", response.ok);


            if (!response.ok) {
                // response.ok is true if status is 200-299
                console.error(`Error updating sheet: HTTP status ${response.status}. Response: ${responseText}`);
                alert(`Failed to update sheet (HTTP ${response.status}). Details: ${responseText}. The change is not saved.`);
                // Don't proceed to next word if update failed, let user retry or acknowledge
                // However, for now, the logic below will still try to parse if responseText is JSON-like
            }

            // Try to parse the response as JSON, regardless of response.ok for now, to see what Apps Script sent
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Failed to parse response from Apps Script as JSON:", e);
                console.error("Response was not valid JSON, content:", responseText);
                if (response.ok) { // If status was ok, but parsing failed, it's an issue.
                    alert(`Error: Received an invalid response from the server. Please check console. Change might not be saved.`);
                }
                // If response.ok was already false, the previous alert about HTTP status is primary.
                // We still try to go to the next word to not block the user.
                displayRandomWord();
                return;
            }


            if (result.status === 'success') {
                console.log("Sheet updated successfully via Apps Script:", result);
                // Update local data to match
                const wordInAllWords = allWords.find(w => w.id === word.id); // Use ID
                if (wordInAllWords) {
                    if (column === 'E') wordInAllWords.tooEasy = (value === 1);
                    if (column === 'F') wordInAllWords.toLearn = (value === 1);
                } else {
                    console.warn("Updated word not found in local 'allWords' cache by ID after successful sheet update. Word:", word);
                }
            } else {
                // This case handles if Apps Script returns a JSON with { status: "error", message: "..." }
                console.error("Apps Script reported an error:", result.message);
                alert(`Failed to update sheet: ${result.message}. The change is not saved.`);
            }
        } catch (error) {
            // This catch handles network errors for fetch itself (e.g., "Failed to fetch")
            console.error("Network error or other exception calling Apps Script:", error);
            alert(`An error occurred while trying to save your change: ${error.message}. This could be a network issue, CORS, or a problem with the server URL. Please ensure your Apps Script is deployed correctly.`);
        } finally {
            loadingSpinner.classList.add('hidden');
            displayRandomWord(); 
        }
    }

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

    async function initializeApp() {
        loadingSpinner.classList.remove('hidden');
        await fetchSpreadsheetData();
        showWelcomePage(); 
    }

    initializeApp();
});