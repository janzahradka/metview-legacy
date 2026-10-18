document.addEventListener('DOMContentLoaded', function () {
    let groups;
    let disclaimer;

    const imageCache = {};
    const imageDisplay = document.getElementById('image-display');
    const slider = document.getElementById('slider');
    const title = document.getElementById('title');
    const groupInfoText = document.getElementById('group-info-text');
    const productGrid = document.getElementById('product-grid');
    const loader = document.getElementById('loader');
    const progressBar = document.getElementById('loader-bar-progress');
    let currentGroup = 'WetterzentraleEurope';
    let currentProductType = '_2';
    let currentImageIndex = 1; // Store the current slider position
    let imagesLoaded = 0;
    let loaderTimeout; // To store the timeout ID

    // Fetch groups and disclaimer data
    Promise.all([
        fetch('groups.json')
            .then(response => response.json())
            .then(data => {
                groups = data;
                console.log('Groups data loaded:', groups); // Debugging log
            })
            .catch(error => console.error('Error fetching groups.json:', error)),

        fetch('disclaimer.json')
            .then(response => response.json())
            .then(data => {
                disclaimer = data.text;
                console.log('Disclaimer loaded:', disclaimer); // Debugging log
                document.querySelector('.content p').textContent = disclaimer;
            })
            .catch(error => console.error('Error fetching disclaimer.json:', error))
    ]).then(initApp);

    function initApp() {
        createGroupDropdown();
        createProductGrid();
        loadImages(currentProductType);
        updateTitle();
        updateGroupInfoText();
        slider.addEventListener('input', (event) => {
            currentImageIndex = parseInt(event.target.value, 10); // Update the current image index
            imageDisplay.src = imageCache[currentImageIndex];
        });
    }

    function updateTitle() {
        const productLabel = groups[currentGroup].product[currentProductType].label;
        title.textContent = `${productLabel}`;
    }

    function updateGroupInfoText() {
    const info = groups[currentGroup]?.infoText; // ← správný klíč
    if (info) {
        groupInfoText.innerHTML = info; // infoText obsahuje HTML (odkaz), proto innerHTML
        groupInfoText.style.display = 'block';
    } else {
        groupInfoText.textContent = '';
        groupInfoText.style.display = 'none';
    }
}


function generateImageUrls(group, productType, customParams = {}) {
    const urls = [];
    const { serverUrl, product, urlPattern } = groups[group];
    const { start, step, extension, numberOfImages } = product[productType];

    // Helper function to format date as YYYYMMDD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    // Get today's date in YYYYMMDD format
    const today = formatDate(new Date());

    for (let i = start; i < numberOfImages; i++) {
        const imageIndex = i * step;
        let firstLeadZero = '';
        if (imageIndex < 10) {
            firstLeadZero = '0';
        }
        let secondLeadZero = '';
        if (imageIndex < 100) {
            secondLeadZero = '0';
        }
        let url = urlPattern
            .replace('${serverUrl}', serverUrl)
            .replace('${productType}', productType)
            .replace('${imageIndex}', imageIndex)
            .replace('${firstLeadZero}', firstLeadZero)
            .replace('${firstLeadZero}', secondLeadZero)
            .replace('${extension}', extension)
            .replace('${today}', today);

        urls.push(url);
    }
    return urls;
}

    function preloadImages(imageUrls, initialImageIndex) {
        imagesLoaded = 0; // Reset the counter
        clearTimeout(loaderTimeout); // Clear any previous timeout
        loaderTimeout = setTimeout(() => {
            loader.classList.remove('hidden'); // Show loader after 1s delay
        }, 1000); // 1 second delay

        imageUrls.forEach((url, index) => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                imagesLoaded++;
                updateProgressBar(imageUrls.length);
                imageCache[index + 1] = img.src;
                if (index + 1 === initialImageIndex) {
                    // Set the initial image based on the slider position
                    imageDisplay.src = img.src;
                }
            };
            img.onerror = () => {
                imagesLoaded++;
                updateProgressBar(imageUrls.length);
            };
        });
    }

    function updateProgressBar(totalImages) {
        const percentLoaded = (imagesLoaded / totalImages) * 100;
        progressBar.style.width = percentLoaded + '%';
        if (imagesLoaded === totalImages) {
            clearTimeout(loaderTimeout); // Clear the timeout to prevent showing the loader
            loader.classList.add('hidden'); // Hide the loader when all images are loaded
        }
    }

    function createProductGrid() {
        productGrid.innerHTML = ''; // Clear existing grid items
        const product = groups[currentGroup].product;
        for (const key in product) {
            if (product.hasOwnProperty(key)) {
                const thumbnailIndex = product[key].thumbnailIndex;
                const thumbnailUrl = generateImageUrls(currentGroup, key)[thumbnailIndex];
                const gridItem = document.createElement('div');
                gridItem.className = 'product-grid-item';
                gridItem.innerHTML = `
                    <img src="${thumbnailUrl}" alt="${product[key].label}">
                    <div>${product[key].label}</div>
                `;
                gridItem.onclick = function () {
                    currentProductType = key;
                    loadImages(key);
                    updateTitle();
                };
                productGrid.appendChild(gridItem);
            }
        }
    }

    function createGroupDropdown() {
        const dropdownButton = document.querySelector('.dropbtn');
        dropdownButton.textContent = `${groups[currentGroup].label} ▼`; // Set the initial group name

        const dropdownContent = document.getElementById('group-dropdown-content');
        dropdownContent.innerHTML = ''; // Clear existing dropdown items
        for (const key in groups) {
            if (groups.hasOwnProperty(key)) {
                const group = groups[key];
                const dropdownItem = document.createElement('a');
                dropdownItem.href = '#';
                dropdownItem.textContent = group.label;
                dropdownItem.onclick = function () {
                    setGroup(key);
                    toggleGroupDropdown();
                };
                dropdownContent.appendChild(dropdownItem);
            }
        }
    }

    window.loadImages = function(productType) {
        const imageUrls = generateImageUrls(currentGroup, productType);
        slider.max = imageUrls.length; // Set the max value of the slider dynamically
        preloadImages(imageUrls, currentImageIndex); // Pass the current image index
    };

    window.setGroup = function(group) {
        currentGroup = group;
        currentProductType = Object.keys(groups[group].product)[0];
        const dropdownButton = document.querySelector('.dropbtn');
        dropdownButton.textContent = `${groups[currentGroup].label} ▼`; // Update the group name in the button
        createProductGrid(); // Create the product grid dynamically for the selected group
        loadImages(currentProductType); // Load the first set of images for the selected group
        updateTitle(); // Update the title with the current product label
        updateGroupInfoText();
    };

    window.toggleGroupDropdown = function() {
        const dropdownContent = document.getElementById('group-dropdown-content');
        if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
        } else {
            dropdownContent.style.display = 'block';
        }
    };

    // Close the dropdown if the user clicks outside of it
    window.onclick = function(event) {
        if (!event.target.matches('.dropbtn')) {
            const dropdownContent = document.getElementById('group-dropdown-content');
            const windowWidth = window.innerWidth;
            if (dropdownContent.style.display === 'block' && windowWidth < 1340) {
                dropdownContent.style.display = 'none';
            }
            if (dropdownContent.style.display === 'block') {
                dropdownContent.style.display = 'none';
            }
        }
    };

    // Collapsible section for disclaimer
    const collapsible = document.querySelector('.collapsible');
    const content = document.querySelector('.content');
    collapsible.addEventListener('click', function() {
        this.classList.toggle('active');
        if (content.style.display === "block") {
            content.style.display = "none";
        } else {
            content.style.display = "block";
        }
    });
});
