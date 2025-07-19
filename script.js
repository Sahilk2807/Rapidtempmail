// --- FIX FOR HOSTING PLATFORMS LIKE INFINITYFREE ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('i') === '1') {
        window.location.href = window.location.pathname;
    }
})();
// --- END OF FIX ---


document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let currentAccount = null;
    let refreshInterval = null;
    const displayedMessageIds = new Set();
    const API_BASE_URL = 'https://api.mail.gw';

    // --- DOM ELEMENTS ---
    const generateBtn = document.getElementById('generate-btn');
    const generateBtnText = document.getElementById('generate-btn-text');
    const generateSpinner = document.getElementById('generate-spinner');
    const domainSelect = document.getElementById('domain-select');
    const copyBtn = document.getElementById('copy-btn');
    const copyBtnText = document.getElementById('copy-btn-text');
    const emailDisplay = document.getElementById('email-display');
    const inboxMessages = document.getElementById('inbox-messages');
    const inboxPlaceholder = document.getElementById('inbox-placeholder');
    const inboxStatus = document.getElementById('inbox-status');
    const refreshBtn = document.getElementById('refresh-btn');

    // Modal Elements
    const messageModal = document.getElementById('message-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSubject = document.getElementById('modal-subject');
    const modalFrom = document.getElementById('modal-from');
    const modalDate = document.getElementById('modal-date');
    const modalBody = document.getElementById('modal-body');

    // --- INITIALIZATION ---
    const init = async () => {
        try {
            const domainResponse = await fetch(`${API_BASE_URL}/domains`);
            const domainData = await domainResponse.json();
            const domains = domainData['hydra:member'];
            domainSelect.innerHTML = '';
            domains.forEach(domainObj => {
                if (domainObj.isActive) {
                    const option = document.createElement('option');
                    option.value = domainObj.domain;
                    option.textContent = domainObj.domain;
                    domainSelect.appendChild(option);
                }
            });
            generateBtn.disabled = false;
            generateBtnText.textContent = 'Generate';
        } catch (error) {
            console.error('Failed to load domains:', error);
            domainSelect.innerHTML = '<option disabled selected>Error loading domains</option>';
            inboxPlaceholder.innerHTML = '<p class="text-red-400">Could not initialize app. ❌</p>';
        }
    };

    // --- API FUNCTIONS ---
    const generateNewEmail = async () => {
        setGenerateButtonLoading(true);
        clearInbox();
        const selectedDomain = domainSelect.value;
        if (!selectedDomain) {
            alert('Please select a domain.');
            setGenerateButtonLoading(false);
            return;
        }
        const username = `user_${Math.random().toString(36).substring(2, 10)}`;
        const password = `pass_${Math.random().toString(36).substring(2, 15)}`;
        const address = `${username}@${selectedDomain}`;
        try {
            const accountResponse = await fetch(`${API_BASE_URL}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, password }) });
            if (!accountResponse.ok) throw new Error('Failed to create account.');
            const accountData = await accountResponse.json();
            const tokenResponse = await fetch(`${API_BASE_URL}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, password }) });
            if (!tokenResponse.ok) throw new Error('Failed to get auth token.');
            const tokenData = await tokenResponse.json();
            currentAccount = { id: accountData.id, address: address, token: tokenData.token };
            emailDisplay.value = currentAccount.address;
            copyBtn.disabled = false;
            inboxPlaceholder.innerHTML = '<p>Waiting for new messages... 📨</p>';
            startInboxRefresh();
        } catch (error) {
            console.error('Error generating email:', error);
            emailDisplay.value = 'Error! Please try again.';
            inboxPlaceholder.innerHTML = '<p class="text-red-400">Could not generate email. ❌</p>';
        } finally {
            setGenerateButtonLoading(false);
        }
    };

    const fetchInboxMessages = async () => {
        if (!currentAccount || !currentAccount.token) return;
        setInboxStatus('fetching');
        try {
            const response = await fetch(`${API_BASE_URL}/messages`, { headers: { 'Authorization': `Bearer ${currentAccount.token}` } });
            if (response.status === 401) { console.error('Token expired or invalid.'); clearInterval(refreshInterval); return; }
            if (!response.ok) throw new Error('Failed to fetch messages.');
            const data = await response.json();
            const messages = data['hydra:member'];
            if (messages.length === 0 && displayedMessageIds.size === 0) {
                inboxPlaceholder.style.display = 'block';
            } else {
                inboxPlaceholder.style.display = 'none';
                messages.forEach(message => {
                    if (!displayedMessageIds.has(message.id)) {
                        const messageEl = createMessageElement(message);
                        inboxMessages.prepend(messageEl);
                        displayedMessageIds.add(message.id);
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching inbox:', error);
            setInboxStatus('error');
        } finally {
            setTimeout(() => setInboxStatus('idle'), 500);
        }
    };

    const fetchAndShowMessage = async (messageId) => {
        if (!currentAccount || !currentAccount.token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, { headers: { 'Authorization': `Bearer ${currentAccount.token}` } });
            if (!response.ok) throw new Error('Failed to read message.');
            const messageData = await response.json();
            modalSubject.textContent = messageData.subject;
            modalFrom.textContent = messageData.from.address;
            modalDate.textContent = new Date(messageData.createdAt).toLocaleString();
            modalBody.innerHTML = messageData.html?.[0] || `<p>${messageData.text.replace(/\n/g, '<br>')}</p>`;
            messageModal.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching message content:', error);
            alert('❌ Could not load message content.');
        }
    };

    // --- UI & HELPER FUNCTIONS ---
    const clearInbox = () => { clearInterval(refreshInterval); currentAccount = null; refreshInterval = null; inboxMessages.innerHTML = ''; displayedMessageIds.clear(); inboxPlaceholder.innerHTML = '<p>Generate an email to see your messages.</p>'; inboxPlaceholder.style.display = 'block'; };
    const startInboxRefresh = () => { if (refreshInterval) clearInterval(refreshInterval); fetchInboxMessages(); refreshInterval = setInterval(fetchInboxMessages, 10000); };
    const manualRefresh = async () => { if (!currentAccount) return; refreshBtn.classList.add('animate-spin'); try { await fetchInboxMessages(); } finally { setTimeout(() => { refreshBtn.classList.remove('animate-spin'); }, 500); } };
    const setGenerateButtonLoading = (isLoading) => { generateBtn.disabled = isLoading; domainSelect.disabled = isLoading; if (isLoading) { generateBtnText.classList.add('hidden'); generateSpinner.classList.remove('hidden'); } else { generateBtnText.classList.remove('hidden'); generateSpinner.classList.add('hidden'); } };
    const setInboxStatus = (status) => { switch(status) { case 'fetching': inboxStatus.innerHTML = '📨'; inboxStatus.classList.add('animate-bounce'); break; case 'error': inboxStatus.innerHTML = '⚠️'; inboxStatus.classList.remove('animate-bounce'); break; default: inboxStatus.innerHTML = ''; inboxStatus.classList.remove('animate-bounce'); break; } };
    
    const createMessageElement = (message) => {
        const item = document.createElement('div');
        item.className = 'message-item p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-0.5';
        item.dataset.id = message.id;
        item.innerHTML = `<div class="flex justify-between items-start"><p class="font-bold text-white truncate pr-4">${message.from.address}</p><p class="text-xs text-gray-400 flex-shrink-0">${new Date(message.createdAt).toLocaleTimeString()}</p></div><p class="text-gray-300 truncate">${message.subject}</p>`;
        return item;
    };
    
    const copyEmailToClipboard = () => { if (!currentAccount) return; navigator.clipboard.writeText(currentAccount.address).then(() => { copyBtnText.textContent = 'Copied! ✅'; copyBtn.classList.add('bg-green-500'); setTimeout(() => { copyBtnText.textContent = 'Copy 📋'; copyBtn.classList.remove('bg-green-500'); }, 2000); }); };
    const closeModal = () => { messageModal.classList.add('hidden'); modalBody.innerHTML = ''; };

    // --- EVENT LISTENERS ---
    generateBtn.addEventListener('click', generateNewEmail);
    copyBtn.addEventListener('click', copyEmailToClipboard);
    refreshBtn.addEventListener('click', manualRefresh);
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !messageModal.classList.contains('hidden')) closeModal(); });
    inboxMessages.addEventListener('click', (e) => { const messageItem = e.target.closest('.message-item'); if (messageItem) { fetchAndShowMessage(messageItem.dataset.id); } });

    // --- START THE APP ---
    init();
});