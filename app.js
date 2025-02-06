document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const selectionCount = document.getElementById('selection-count');
    let selectedImages = new Set();
    const colorThief = new ColorThief();
    const canvasControls = document.getElementById('canvas-controls');
    const colorPreview = document.getElementById('color-preview');
    const colorInput = document.getElementById('color-input');
    const eyedropperBtn = document.getElementById('eyedropper-btn');
    const canvasPreview = document.getElementById('canvas-preview');
    let currentOrientation = 'landscape';
    let currentAspectRatio = '1:1';
    let canvasColor = '#FFFFFF';
    const applyImageBtn = document.getElementById('apply-image-btn');
    const applyHelpText = document.getElementById('apply-help-text');
    let selectedImageElement = null;

    // Add new variables for sliders
    const sizeSlider = document.getElementById('size-slider');
    const xPositionSlider = document.getElementById('x-position-slider');
    const yPositionSlider = document.getElementById('y-position-slider');
    const sizeValue = document.getElementById('size-value');
    const xPositionValue = document.getElementById('x-position-value');
    const yPositionValue = document.getElementById('y-position-value');

    // Add image adjustment state
    let imageSize = 80;  // Default to 80%
    let xPosition = 0;   // Default to center
    let yPosition = 0;   // Default to center

    // Initialize color preview
    colorPreview.style.backgroundColor = canvasColor;
    colorInput.value = canvasColor;
    
    // Initialize default buttons
    document.querySelector('[data-orientation="landscape"]').classList.add('active');
    document.querySelector('[data-ratio="1:1"]').classList.add('active');
    
    // Show canvas controls and initial preview
    canvasControls.classList.add('visible');
    updateCanvasPreview();

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
    
    // Handle selected files
    fileInput.addEventListener('change', handleFiles, false);

    // Handle keyboard events for selection
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSelection();
        }
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        uploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = [...e.target.files];
        files.forEach(previewFile);
    }

    function updateSelectionCount() {
        const count = selectedImages.size;
        selectionCount.innerHTML = `
            <span class="material-icons" style="margin-right: 8px;">photo_library</span>
            <span>${count} image${count !== 1 ? 's' : ''} selected</span>
        `;
        selectionCount.classList.toggle('visible', count > 0);
        
        // Update apply button state
        applyImageBtn.disabled = count !== 1;
        applyHelpText.classList.toggle('visible', count !== 1);
        
        // Store the selected image element
        selectedImageElement = count === 1 ? 
            document.querySelector('.preview-item.selected img') : null;

        // Reset sliders when selection changes
        if (count === 1) {
            sizeSlider.value = 80;
            xPositionSlider.value = 0;
            yPositionSlider.value = 0;
            imageSize = 80;
            xPosition = 0;
            yPosition = 0;
            sizeValue.textContent = '80%';
            xPositionValue.textContent = 'Center';
            yPositionValue.textContent = 'Center';
        }
        
        updateCanvasPreview();
    }

    function toggleSelection(previewItem, id) {
        if (selectedImages.has(id)) {
            selectedImages.delete(id);
            previewItem.classList.remove('selected');
        } else {
            selectedImages.add(id);
            previewItem.classList.add('selected');
        }
        updateSelectionCount();
    }

    function clearSelection() {
        selectedImages.clear();
        document.querySelectorAll('.preview-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        updateSelectionCount();
    }

    async function previewFile(file) {
        try {
            // Check if file is an image
            if (!file.type.startsWith('image/') && 
                !(file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif'))) {
                alert('Please upload image files only.');
                return;
            }

            // Handle HEIC/HEIF format
            let processedFile = file;
            let processedBlob = null;
            let originalExif = null;
            
            if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                try {
                    console.log('Processing HEIC/HEIF file:', file.name);
                    
                    // Extract EXIF data using exif-heic-js
                    const reader = new FileReader();
                    await new Promise((resolve, reject) => {
                        reader.onload = function() {
                            try {
                                const tags = findEXIFinHEIC(reader.result);
                                console.log('HEIC EXIF tags:', tags);
                                
                                if (tags['GPSLatitude'] && tags['GPSLatitudeRef'] && 
                                    tags['GPSLongitude'] && tags['GPSLongitudeRef']) {
                                    
                                    // Convert GPS coordinates to decimal format
                                    const lat = convertGPSToDecimal(tags['GPSLatitude'], tags['GPSLatitudeRef']);
                                    const lon = convertGPSToDecimal(tags['GPSLongitude'], tags['GPSLongitudeRef']);
                                    
                                    originalExif = {
                                        gps: {
                                            latitude: lat,
                                            longitude: lon
                                        }
                                    };
                                    
                                    if (tags['DateTimeOriginal']) {
                                        originalExif.datetime = tags['DateTimeOriginal'];
                                    }
                                    
                                    console.log('Extracted GPS data:', originalExif);
                                } else {
                                    console.log('No GPS data found in HEIC file');
                                }
                                resolve();
                            } catch (error) {
                                console.error('Error extracting HEIC metadata:', error);
                                resolve();
                            }
                        };
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(file);
                    });

                    const blob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 1
                    });
                    processedBlob = Array.isArray(blob) ? blob[0] : blob;
                    
                    // Store original EXIF data for later use
                    if (originalExif) {
                        processedBlob.exifData = originalExif;
                    }
                    
                    processedFile = new File([processedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: file.lastModified
                    });
                    
                    console.log('HEIC conversion complete. New file size:', formatFileSize(processedBlob.size));
                } catch (error) {
                    console.error('Error processing HEIC:', error);
                    alert('Error processing HEIC image. This format might not be supported by your browser.');
                    return;
                }
            }

            const reader = new FileReader();
            reader.readAsDataURL(processedFile);

            reader.onloadend = async function() {
                const id = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.dataset.id = id;

                // Create action buttons container
                const actionButtons = document.createElement('div');
                actionButtons.className = 'action-buttons';

                // Create delete button
                const deleteButton = document.createElement('button');
                deleteButton.className = 'action-button delete';
                deleteButton.title = 'Remove image';
                deleteButton.innerHTML = '<span class="material-icons">delete_outline</span>';
                deleteButton.onclick = (e) => {
                    e.stopPropagation();
                    if (selectedImages.has(id)) {
                        selectedImages.delete(id);
                        updateSelectionCount();
                    }
                    previewItem.remove();
                };
                actionButtons.appendChild(deleteButton);

                // Create image element
                const img = document.createElement('img');
                img.src = reader.result;

                // Create info container
                const info = document.createElement('div');
                info.className = 'preview-info';

                // Add file name
                const fileName = document.createElement('div');
                fileName.className = 'file-name';
                fileName.textContent = file.name + (processedBlob ? ' (Converted from HEIC)' : '');
                info.appendChild(fileName);

                // Create table for detailed information
                const table = document.createElement('table');
                
                // Add file information
                const rows = [
                    ['File size', formatFileSize(file.size)],
                    ['File type', processedBlob ? 'image/jpeg (converted from HEIC)' : file.type],
                    ['Last modified', new Date(file.lastModified).toLocaleString()]
                ];

                // Get image dimensions and add more metadata
                const tempImg = new Image();
                tempImg.src = reader.result;
                tempImg.onload = function() {
                    // Calculate preview dimensions
                    const previewDims = calculatePreviewDimensions(this.naturalWidth, this.naturalHeight);
                    
                    // Set image dimensions using CSS max-width/max-height
                    img.style.maxWidth = `${previewDims.width}px`;
                    img.style.maxHeight = `${previewDims.height}px`;
                    
                    // Add dimensions
                    rows.push(['Dimensions', `${this.naturalWidth} × ${this.naturalHeight} pixels`]);
                    rows.push(['Aspect ratio', calculateAspectRatio(this.naturalWidth, this.naturalHeight)]);

                    // Create table rows
                    rows.forEach(([label, value]) => {
                        const row = table.insertRow();
                        const cell1 = row.insertCell(0);
                        const cell2 = row.insertCell(1);
                        cell1.textContent = label;
                        cell2.textContent = value;
                    });

                    // Extract colors after image is properly loaded
                    if (img.complete) {
                        extractAndDisplayColors(img, colorPalette);
                    } else {
                        img.addEventListener('load', function() {
                            extractAndDisplayColors(img, colorPalette);
                        });
                    }
                };

                info.appendChild(table);

                // Extract and display prominent colors
                const colorPalette = document.createElement('div');
                colorPalette.className = 'color-palette';
                
                // Add a row for colors in the table
                const colorRow = table.insertRow();
                colorRow.insertCell(0).textContent = 'Prominent Colors';
                const colorCell = colorRow.insertCell(1);
                colorCell.appendChild(colorPalette);

                // Extract colors using Color Thief
                if (tempImg.complete) {
                    extractAndDisplayColors(tempImg, colorPalette);
                } else {
                    tempImg.addEventListener('load', function() {
                        extractAndDisplayColors(tempImg, colorPalette);
                    });
                }

                // Try to extract EXIF data if available
                if (processedFile.type === 'image/jpeg' || processedFile.type === 'image/tiff') {
                    let exifData;
                    
                    // First try to use stored EXIF data from HEIC conversion
                    if (processedBlob && processedBlob.exifData) {
                        exifData = processedBlob.exifData;
                        console.log('Using stored EXIF data:', exifData);
                    } else {
                        // If no stored data, try to extract from the processed file
                        exifData = await extractExifData(processedFile);
                    }

                    if (exifData) {
                        console.log('Final EXIF data:', exifData);
                        const metaInfo = document.createElement('div');
                        metaInfo.className = 'meta-info';
                        
                        if (exifData.datetime) {
                            const dateRow = table.insertRow();
                            dateRow.insertCell(0).textContent = 'Created Date';
                            dateRow.insertCell(1).textContent = exifData.datetime;
                        }
                        
                        if (exifData.gps) {
                            const gpsRow = table.insertRow();
                            gpsRow.insertCell(0).textContent = 'Location';
                            const lat = exifData.gps.latitude.toFixed(6);
                            const lon = exifData.gps.longitude.toFixed(6);
                            gpsRow.insertCell(1).textContent = `${lat}, ${lon}`;
                            console.log('Adding GPS data to display:', lat, lon);
                        }
                    }
                }

                // Add click handler for selection
                previewItem.onclick = () => toggleSelection(previewItem, id);

                previewItem.appendChild(actionButtons);
                previewItem.appendChild(img);
                previewItem.appendChild(info);
                previewArea.appendChild(previewItem);
            };
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function calculateAspectRatio(width, height) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        return `${width/divisor}:${height/divisor}`;
    }

    async function extractExifData(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const view = new DataView(e.target.result);
                try {
                    let offset = 2;
                    if (view.getUint16(0) !== 0xFFD8) {
                        console.log('Not a valid JPEG file');
                        resolve(null);
                        return;
                    }

                    while (offset < view.byteLength) {
                        const marker = view.getUint16(offset);
                        if (marker === 0xFFE1) {
                            console.log('Found EXIF marker');
                            if (view.getUint32(offset + 4) === 0x45786966) { // 'Exif'
                                const exifData = parseExif(view, offset + 10);
                                console.log('Parsed EXIF data:', exifData);
                                resolve(exifData);
                                return;
                            }
                        }
                        offset += 2 + view.getUint16(offset + 2);
                    }
                    console.log('No EXIF data found');
                    resolve(null);
                } catch (e) {
                    console.error('Error parsing EXIF:', e);
                    resolve(null);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function parseExif(view, offset) {
        const data = {};
        try {
            // Check byte order
            const byteOrder = view.getUint16(offset);
            const littleEndian = byteOrder === 0x4949;
            
            if (byteOrder !== 0x4949 && byteOrder !== 0x4D4D) {
                console.log('Invalid byte order marker');
                return null;
            }

            offset += 2;
            // Check TIFF tag mark
            const tiffCheck = view.getUint16(offset, littleEndian);
            if (tiffCheck !== 0x002A) {
                console.log('Invalid TIFF marker');
                return null;
            }

            // Get offset to first IFD
            offset += 2;
            const ifdOffset = view.getUint32(offset, littleEndian);
            offset += ifdOffset - 4;

            // Read IFD entries
            const entries = view.getUint16(offset, littleEndian);
            offset += 2;
            console.log(`Found ${entries} IFD entries`);

            for (let i = 0; i < entries; i++) {
                const tag = view.getUint16(offset, littleEndian);
                const format = view.getUint16(offset + 2, littleEndian);
                const components = view.getUint32(offset + 4, littleEndian);
                const valueOffset = view.getUint32(offset + 8, littleEndian);

                // DateTime tag (0x0132)
                if (tag === 0x0132) {
                    const dateStr = new Array(components).fill(0)
                        .map((_, i) => String.fromCharCode(view.getUint8(valueOffset + i)))
                        .join('');
                    data.datetime = dateStr;
                    console.log('Found DateTime:', dateStr);
                }

                // GPS IFD Pointer (0x8825)
                if (tag === 0x8825) {
                    console.log('Found GPS IFD pointer');
                    const gpsData = parseGpsData(view, valueOffset + offset - 8, littleEndian);
                    if (gpsData) {
                        data.gps = gpsData;
                        console.log('Parsed GPS data:', gpsData);
                    }
                }

                offset += 12;
            }
        } catch (e) {
            console.error('Error in parseExif:', e);
            return null;
        }

        return Object.keys(data).length ? data : null;
    }

    function parseGpsData(view, offset, littleEndian) {
        try {
            // Add bounds checking
            if (offset >= view.byteLength) {
                console.log('GPS data offset out of bounds');
                return null;
            }

            const entries = view.getUint16(offset, littleEndian);
            console.log(`Found ${entries} GPS entries`);
            
            // Add reasonable limit to entries to prevent invalid data
            if (entries > 100) {
                console.log('Too many GPS entries, likely invalid data');
                return null;
            }
            
            offset += 2;

            let lat = null, latRef = null, lon = null, lonRef = null;

            for (let i = 0; i < entries; i++) {
                // Check if we have enough bytes left to read the entry
                if (offset + 12 > view.byteLength) {
                    console.log('Reached end of data while parsing GPS entries');
                    break;
                }

                const tag = view.getUint16(offset, littleEndian);
                const format = view.getUint16(offset + 2, littleEndian);
                const components = view.getUint32(offset + 4, littleEndian);
                let valueOffset = view.getUint32(offset + 8, littleEndian);

                // Validate valueOffset
                if (valueOffset >= view.byteLength) {
                    console.log('Invalid value offset in GPS data');
                    continue;
                }

                // For small values, the value is stored directly in the offset field
                if (format <= 4 && components <= 4) {
                    valueOffset = offset + 8;
                }

                try {
                    switch (tag) {
                        case 1: // GPSLatitudeRef
                            latRef = String.fromCharCode(view.getUint8(valueOffset));
                            break;
                        case 2: // GPSLatitude
                            if (format === 5) {
                                lat = parseGpsRational(view, valueOffset, components, littleEndian);
                            }
                            break;
                        case 3: // GPSLongitudeRef
                            lonRef = String.fromCharCode(view.getUint8(valueOffset));
                            break;
                        case 4: // GPSLongitude
                            if (format === 5) {
                                lon = parseGpsRational(view, valueOffset, components, littleEndian);
                            }
                            break;
                    }
                } catch (e) {
                    console.log('Error parsing GPS tag:', tag, e);
                    continue;
                }

                offset += 12;
            }

            if (lat !== null && latRef !== null && lon !== null && lonRef !== null) {
                return {
                    latitude: latRef === 'N' ? lat : -lat,
                    longitude: lonRef === 'E' ? lon : -lon
                };
            }
        } catch (e) {
            console.log('Error parsing GPS data:', e);
        }
        return null;
    }

    function parseGpsRational(view, offset, components, littleEndian) {
        try {
            const degrees = view.getUint32(offset, littleEndian) / view.getUint32(offset + 4, littleEndian);
            const minutes = view.getUint32(offset + 8, littleEndian) / view.getUint32(offset + 12, littleEndian);
            const seconds = components > 2 ? 
                view.getUint32(offset + 16, littleEndian) / view.getUint32(offset + 20, littleEndian) : 0;

            console.log('GPS components:', { degrees, minutes, seconds });
            return degrees + (minutes / 60) + (seconds / 3600);
        } catch (e) {
            console.error('Error parsing GPS rational:', e);
            return null;
        }
    }

    function convertGPSToDecimal(components, ref) {
        // Handle different formats of GPS data
        let parts;
        if (Array.isArray(components)) {
            parts = components;
        } else if (typeof components === 'string') {
            // Handle string format like "42/1 45/1 30/1"
            parts = components.split(' ').map(part => {
                const [num, denom] = part.split('/').map(Number);
                return denom ? num / denom : num;
            });
        } else {
            console.error('Unsupported GPS component format:', components);
            return null;
        }

        if (parts.length < 2) return null;

        const degrees = parts[0];
        const minutes = parts[1];
        const seconds = parts.length > 2 ? parts[2] : 0;

        let decimal = degrees + (minutes / 60) + (seconds / 3600);
        
        // Make negative if ref is South or West
        if (ref === 'S' || ref === 'W') {
            decimal = -decimal;
        }

        return decimal;
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    function extractAndDisplayColors(img, container) {
        try {
            // Create color section container
            const colorSection = document.createElement('div');
            colorSection.className = 'color-section';

            // Get dominant color
            const dominantColor = colorThief.getColor(img);
            const dominantHex = rgbToHex(dominantColor[0], dominantColor[1], dominantColor[2]);

            // Create dominant color section
            const dominantSection = document.createElement('div');
            dominantSection.innerHTML = '<h3>Dominant Color</h3>';
            const dominantSwatch = createColorSwatch(dominantColor);
            dominantSection.appendChild(dominantSwatch);
            colorSection.appendChild(dominantSection);

            // Get color palette
            const palette = colorThief.getPalette(img, 8);
            
            // Create palette section
            const paletteSection = document.createElement('div');
            paletteSection.innerHTML = '<h3>Color Palette</h3>';
            const paletteContainer = document.createElement('div');
            paletteContainer.className = 'color-palette';

            palette.forEach(color => {
                const swatch = createColorSwatch(color);
                paletteContainer.appendChild(swatch);
            });

            paletteSection.appendChild(paletteContainer);
            colorSection.appendChild(paletteSection);

            // Replace the container's content with the new color section
            container.innerHTML = '';
            container.appendChild(colorSection);
        } catch (error) {
            console.error('Error extracting colors:', error);
        }
    }

    function createColorSwatch(color) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        
        // Convert RGB to HEX
        const hexColor = rgbToHex(color[0], color[1], color[2]);
        swatch.style.backgroundColor = hexColor;
        
        // Add tooltip with hex code and copy icon
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerHTML = `
            ${hexColor}
            <span class="material-icons" style="font-size: 14px; margin-left: 4px;">content_copy</span>
        `;
        swatch.appendChild(tooltip);
        
        // Add click to copy functionality
        swatch.addEventListener('click', () => {
            navigator.clipboard.writeText(hexColor).then(() => {
                tooltip.classList.add('copied');
                tooltip.innerHTML = `
                    ${hexColor}
                    <span class="material-icons" style="font-size: 14px; margin-left: 4px; color: #4CAF50;">check</span>
                `;
                setTimeout(() => {
                    tooltip.classList.remove('copied');
                    tooltip.innerHTML = `
                        ${hexColor}
                        <span class="material-icons" style="font-size: 14px; margin-left: 4px;">content_copy</span>
                    `;
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy color:', err);
            });
        });
        
        return swatch;
    }

    // Update button states
    function updateButtonStates() {
        // Update orientation buttons
        document.querySelectorAll('.orientation-btn').forEach(btn => {
            if (btn.dataset.orientation === currentOrientation) {
                btn.setAttribute('active', '');
            } else {
                btn.removeAttribute('active');
            }
        });

        // Update aspect ratio buttons
        document.querySelectorAll('.aspect-btn').forEach(btn => {
            if (btn.dataset.ratio === currentAspectRatio) {
                btn.setAttribute('active', '');
            } else {
                btn.removeAttribute('active');
            }
        });

        // Hide 2.35:1 option in portrait mode
        const cinemaButton = document.querySelector('.aspect-btn[data-ratio="2.35:1"]');
        if (cinemaButton) {
            cinemaButton.style.display = currentOrientation === 'portrait' ? 'none' : 'block';
            // If hidden ratio was selected, switch to square
            if (currentOrientation === 'portrait' && currentAspectRatio === '2.35:1') {
                currentAspectRatio = '1:1';
                document.querySelector('.aspect-btn[data-ratio="1:1"]').setAttribute('active', '');
            }
        }
    }

    // Handle orientation toggle
    document.querySelectorAll('.orientation-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentOrientation = btn.dataset.orientation;
            updateButtonStates();
            updateAspectRatioButtons();
            updateCanvasPreview();
        });
    });

    // Handle aspect ratio selection
    document.querySelectorAll('.aspect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAspectRatio = btn.dataset.ratio;
            updateButtonStates();
            updateCanvasPreview();
        });
    });

    // Initialize default states
    updateButtonStates();

    // Handle color input
    colorInput.addEventListener('input', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            canvasColor = color;
            colorPreview.style.backgroundColor = color;
            updateCanvasPreview();
        }
    });

    // Handle eyedropper
    eyedropperBtn.addEventListener('click', async () => {
        if (!window.EyeDropper) {
            alert('Your browser does not support the EyeDropper API');
            return;
        }

        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            canvasColor = result.sRGBHex;
            colorInput.value = canvasColor;
            colorPreview.style.backgroundColor = canvasColor;
            updateCanvasPreview();
        } catch (e) {
            console.error('EyeDropper failed:', e);
        }
    });

    function updateAspectRatioButtons() {
        const buttons = document.querySelectorAll('.aspect-btn');
        buttons.forEach(btn => {
            const ratio = btn.dataset.ratio;
            if (currentOrientation === 'portrait' && ratio !== '1:1') {
                // Flip the ratio for portrait mode
                const [w, h] = ratio.split(':');
                btn.textContent = `${h}:${w}`;
            } else {
                // Reset to original ratio text
                switch (ratio) {
                    case '1:1': btn.textContent = 'Square (1:1)'; break;
                    case '16:9': btn.textContent = '16:9'; break;
                    case '4:3': btn.textContent = '4:3'; break;
                    case '2.35:1': btn.textContent = '2.35:1'; break;
                }
            }
        });
    }

    function updateCanvasPreview() {
        // Clear previous preview
        canvasPreview.innerHTML = '';

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size based on aspect ratio
        let [width, height] = currentAspectRatio.split(':').map(Number);
        if (currentOrientation === 'portrait' && currentAspectRatio !== '1:1') {
            [width, height] = [height, width];
        }

        // Set canvas size to match preview container's width while maintaining aspect ratio
        const containerWidth = canvasPreview.clientWidth;
        canvas.width = containerWidth;
        canvas.height = (containerWidth * height) / width;

        // Add shadow effect to canvas
        canvas.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        canvas.style.border = '1px solid #e0e0e0';
        canvas.style.borderRadius = '8px';

        // Fill canvas with selected color
        ctx.fillStyle = canvasColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        canvasPreview.appendChild(canvas);
    }

    // Add click handler for apply button
    applyImageBtn.addEventListener('click', () => {
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    });

    // Add image style state
    let imageEffects = {
        dropShadow: true
    };

    // Handle shadow effect toggle
    const shadowEffect = document.getElementById('shadow-effect');
    shadowEffect.addEventListener('click', () => {
        imageEffects.dropShadow = !imageEffects.dropShadow;
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    });

    function drawImageOnCanvas(img) {
        const canvas = canvasPreview.querySelector('canvas');
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        
        // Add this line near the beginning of the function
        const fontSizeRatio = canvas.width / 800; // Base ratio on a reference width of 800px
        
        // Calculate base image dimensions to fit canvas while maintaining aspect ratio
        const imageAspect = img.naturalWidth / img.naturalHeight;
        let baseWidth, baseHeight;
        
        if (canvas.width / imageAspect <= canvas.height) {
            baseWidth = canvas.width;
            baseHeight = canvas.width / imageAspect;
        } else {
            baseHeight = canvas.height;
            baseWidth = canvas.height * imageAspect;
        }

        // Apply size adjustment
        const scale = imageSize / 100;
        const drawWidth = baseWidth * scale;
        const drawHeight = baseHeight * scale;

        // Calculate position with slider values
        const xOffset = (canvas.width - drawWidth) / 2;
        const yOffset = (canvas.height - drawHeight) / 2;
        
        // Apply position adjustments
        const x = xOffset + (canvas.width * xPosition / 200);
        const y = yOffset + (canvas.height * yPosition / 200);

        // Clear canvas and fill with selected color
        ctx.fillStyle = canvasColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw shadow if enabled
        if (imageEffects.dropShadow) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = 10;
        }

        // Draw image with all adjustments
        ctx.drawImage(img, x, y, drawWidth, drawHeight);

        if (imageEffects.dropShadow) {
            ctx.restore();
        }

        // Draw text overlay
        if (textOverlay.title || textOverlay.subtitle) {
            ctx.save();
            ctx.textAlign = 'left';
            
            // Calculate text position
            const padding = canvas.width * 0.05;
            const xPos = (canvas.width * (textOverlay.xPosition / 100)) - (canvas.width * 0.4);
            const yPos = canvas.height * (textOverlay.yPosition / 100);
            let currentY = yPos;

            // Draw title
            if (textOverlay.title) {
                const titleLines = textOverlay.title.split('\n');
                const titleFontSize = textOverlay.fontSize * fontSizeRatio;
                
                titleLines.forEach(line => {
                    if (line.trim()) {
                        // Set font and style
                        ctx.font = `${textOverlay.titleFontStyle} ${textOverlay.titleFontWeight} ${titleFontSize}px "${textOverlay.titleFontFamily}"`;
                        
                        // Draw text shadow if enabled
                        if (textOverlay.dropShadow) {
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                            ctx.shadowBlur = 4 * fontSizeRatio;
                            ctx.shadowOffsetX = 2 * fontSizeRatio;
                            ctx.shadowOffsetY = 2 * fontSizeRatio;
                        }

                        // Draw text with outline
                        const outlineWidth = textOverlay.outlineWidth * fontSizeRatio;
                        
                        // Draw outline first
                        ctx.lineWidth = outlineWidth * 4;  // Double the width for better visibility
                        ctx.strokeStyle = textOverlay.outlineColor;
                        ctx.lineJoin = "round";
                        ctx.miterLimit = 2;
                        ctx.strokeText(line, xPos + padding, currentY);
                        
                        // Then draw the text fill
                        ctx.fillStyle = hexToRGBA(textOverlay.color, textOverlay.opacity / 100);
                        ctx.fillText(line, xPos + padding, currentY);
                        
                        currentY += titleFontSize * (textOverlay.lineHeight / 100);
                        ctx.shadowColor = 'transparent';
                    }
                });
            }
            
            // Draw subtitle with similar pattern
            if (textOverlay.subtitle) {
                const subtitleLines = textOverlay.subtitle.split('\n');
                const subtitleSize = (textOverlay.fontSize * 0.7) * fontSizeRatio;
                
                subtitleLines.forEach(line => {
                    if (line.trim()) {
                        ctx.font = `${textOverlay.subtitleFontStyle} ${textOverlay.subtitleFontWeight} ${subtitleSize}px "${textOverlay.subtitleFontFamily}"`;
                        
                        if (textOverlay.dropShadow) {
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                            ctx.shadowBlur = 4 * fontSizeRatio;
                            ctx.shadowOffsetX = 2 * fontSizeRatio;
                            ctx.shadowOffsetY = 2 * fontSizeRatio;
                        }

                        // Draw text with outline
                        const outlineWidth = (textOverlay.outlineWidth * 0.7) * fontSizeRatio;
                        
                        // Draw outline first
                        ctx.lineWidth = outlineWidth * 2;
                        ctx.strokeStyle = textOverlay.outlineColor;
                        ctx.lineJoin = "round";
                        ctx.miterLimit = 2;
                        ctx.strokeText(line, xPos + padding, currentY);
                        
                        // Then draw the text fill
                        ctx.fillStyle = hexToRGBA(textOverlay.color, textOverlay.opacity / 100);
                        ctx.fillText(line, xPos + padding, currentY);
                        
                        currentY += subtitleSize * (textOverlay.lineHeight / 100);
                        ctx.shadowColor = 'transparent';
                    }
                });
            }
            
            ctx.restore();
        }
    }

    // Handle slider changes
    sizeSlider.addEventListener('input', (e) => {
        imageSize = parseInt(e.target.value);
        sizeValue.textContent = `${imageSize}%`;
        
        // Update progress bar
        const progress = (imageSize / 500) * 100;
        e.target.style.setProperty('--slider-progress', `${progress}%`);
        
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    });

    xPositionSlider.addEventListener('input', (e) => {
        xPosition = parseInt(e.target.value);
        const label = xPosition === 0 ? 'Center' : 
                     xPosition > 0 ? `${xPosition}% Right` : 
                     `${Math.abs(xPosition)}% Left`;
        xPositionValue.textContent = label;
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    });

    yPositionSlider.addEventListener('input', (e) => {
        yPosition = parseInt(e.target.value);
        const label = yPosition === 0 ? 'Center' : 
                     yPosition > 0 ? `${yPosition}% Down` : 
                     `${Math.abs(yPosition)}% Up`;
        yPositionValue.textContent = label;
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    });

    // Initialize slider progress
    function initializeSliders() {
        const progress = (imageSize / 500) * 100;
        sizeSlider.style.setProperty('--slider-progress', `${progress}%`);
    }

    // Call initialization when page loads
    initializeSliders();

    // Add this function to calculate image dimensions
    function calculatePreviewDimensions(naturalWidth, naturalHeight) {
        const screenWidth = window.innerWidth;
        const maxPreviewWidth = Math.min(screenWidth * 0.5, 800); // 50% of screen width or 800px
        const targetWidth = Math.min(naturalWidth * 0.3, maxPreviewWidth); // 30% of original or max preview
        
        // Calculate height while maintaining aspect ratio
        const aspectRatio = naturalWidth / naturalHeight;
        const targetHeight = targetWidth / aspectRatio;
        
        return {
            width: Math.round(targetWidth),
            height: Math.round(targetHeight)
        };
    }

    // Call initialization when page loads
    initializeSliders();

    // Add download button functionality
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = true;

    function downloadCanvas() {
        if (!selectedImageElement) return;
        
        // Get reference to the preview canvas
        const previewCanvas = canvasPreview.querySelector('canvas');
        if (!previewCanvas) return;
        
        // Create a high-resolution canvas for export
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        
        // Set canvas size based on aspect ratio and image size
        let [width, height] = currentAspectRatio.split(':').map(Number);
        if (currentOrientation === 'portrait' && currentAspectRatio !== '1:1') {
            [width, height] = [height, width];
        }

        // Calculate dimensions based on the original image size
        const baseSize = Math.max(selectedImageElement.naturalWidth, selectedImageElement.naturalHeight);
        const scale = imageSize / 100;
        
        // Set high-resolution canvas size
        exportCanvas.width = baseSize * (width / Math.max(width, height));
        exportCanvas.height = baseSize * (height / Math.max(width, height));

        // Fill canvas with selected color
        ctx.fillStyle = canvasColor;
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw image with shadow if enabled
        if (imageEffects.dropShadow) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = exportCanvas.width * 0.02; // Scale shadow blur with canvas size
            ctx.shadowOffsetX = exportCanvas.width * 0.01;
            ctx.shadowOffsetY = exportCanvas.width * 0.01;
        }

        // Calculate image dimensions and position
        const imageAspect = selectedImageElement.naturalWidth / selectedImageElement.naturalHeight;
        let drawWidth, drawHeight;
        
        if (exportCanvas.width / imageAspect <= exportCanvas.height) {
            drawWidth = exportCanvas.width * scale;
            drawHeight = (exportCanvas.width / imageAspect) * scale;
        } else {
            drawHeight = exportCanvas.height * scale;
            drawWidth = (exportCanvas.height * imageAspect) * scale;
        }

        // Calculate position with slider values
        const xOffset = (exportCanvas.width - drawWidth) / 2;
        const yOffset = (exportCanvas.height - drawHeight) / 2;
        const x = xOffset + (exportCanvas.width * xPosition / 200);
        const y = yOffset + (exportCanvas.height * yPosition / 200);

        // Draw the image
        ctx.drawImage(selectedImageElement, x, y, drawWidth, drawHeight);

        if (imageEffects.dropShadow) {
            ctx.restore();
        }

        // Draw text overlay if exists
        if (textOverlay.title || textOverlay.subtitle) {
            ctx.save();
            ctx.textAlign = 'left';
            
            // Calculate text position
            const padding = exportCanvas.width * 0.05; // 5% padding from the left edge
            const xPos = (exportCanvas.width * (textOverlay.xPosition / 100)) - (exportCanvas.width * 0.4);
            const yPos = exportCanvas.height * (textOverlay.yPosition / 100);
            let currentY = yPos;
            
            // Scale font sizes based on canvas size ratio
            const fontSizeRatio = exportCanvas.width / previewCanvas.width;
            
            // Draw title
            if (textOverlay.title) {
                const titleLines = textOverlay.title.split('\n');
                const titleFontSize = textOverlay.fontSize * fontSizeRatio;
                ctx.font = `${textOverlay.titleFontStyle} ${textOverlay.titleFontWeight} ${titleFontSize}px "${textOverlay.titleFontFamily}"`;
                
                // Apply text shadow if enabled
                if (textOverlay.dropShadow) {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 4 * fontSizeRatio;
                    ctx.shadowOffsetX = 2 * fontSizeRatio;
                    ctx.shadowOffsetY = 2 * fontSizeRatio;
                }

                ctx.fillStyle = hexToRGBA(textOverlay.color, textOverlay.opacity / 100);
                
                // Draw each line of the title
                titleLines.forEach(line => {
                    if (line.trim()) {  // Only draw non-empty lines
                        ctx.fillText(line, xPos + padding, currentY);
                        currentY += titleFontSize * (textOverlay.lineHeight / 100);
                    }
                });
                
                ctx.shadowColor = 'transparent';
            }
            
            // Draw subtitle
            if (textOverlay.subtitle) {
                const subtitleLines = textOverlay.subtitle.split('\n');
                const subtitleSize = (textOverlay.fontSize * 0.7) * fontSizeRatio;
                ctx.font = `${textOverlay.subtitleFontStyle} ${textOverlay.subtitleFontWeight} ${subtitleSize}px "${textOverlay.subtitleFontFamily}"`;
                
                // Apply text shadow if enabled
                if (textOverlay.dropShadow) {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 4 * fontSizeRatio;
                    ctx.shadowOffsetX = 2 * fontSizeRatio;
                    ctx.shadowOffsetY = 2 * fontSizeRatio;
                }

                ctx.fillStyle = hexToRGBA(textOverlay.color, textOverlay.opacity / 100);
                
                // Draw each line of the subtitle
                subtitleLines.forEach(line => {
                    if (line.trim()) {  // Only draw non-empty lines
                        ctx.fillText(line, xPos + padding, currentY);
                        currentY += subtitleSize * (textOverlay.lineHeight / 100);
                    }
                });
                
                ctx.shadowColor = 'transparent';
            }
            
            ctx.restore();
        }

        // Generate filename with datetime and parameters
        const now = new Date();
        const datetime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const originalFilename = selectedImageElement.src.split('/').pop().split('.')[0];
        
        // Clean up title and subtitle for filename
        const cleanTitle = textOverlay.title ? textOverlay.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'no-title';
        const cleanSubtitle = textOverlay.subtitle ? textOverlay.subtitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'no-subtitle';
        
        const filename = `${datetime}_${currentOrientation}_${currentAspectRatio.replace(':', '-')}_${cleanTitle}_${cleanSubtitle}__${originalFilename}.png`;

        // Create download link
        const link = document.createElement('a');
        link.download = filename;
        link.href = exportCanvas.toDataURL('image/png', 1.0);
        link.click();
    }

    // Add click handler for download button
    downloadBtn.addEventListener('click', downloadCanvas);

    // Update download button state when image is selected/deselected
    function updateDownloadButtonState() {
        downloadBtn.disabled = !selectedImageElement;
    }

    // Add download button state update to selection handling
    const originalUpdateSelectionCount = updateSelectionCount;
    updateSelectionCount = function() {
        originalUpdateSelectionCount();
        updateDownloadButtonState();
    };

    // Add text overlay state
    let textOverlay = {
        title: '',
        subtitle: '',
        titleFontFamily: 'Cabin Condensed',
        subtitleFontFamily: 'Cabin Condensed',
        titleFontWeight: '400',
        subtitleFontWeight: '400',
        titleFontStyle: 'normal',
        subtitleFontStyle: 'normal',
        color: '#FFFFFF',
        opacity: 100,
        dropShadow: true,
        fontSize: 32,
        lineHeight: 150,
        xPosition: 50,
        yPosition: 50,
        outlineColor: '#000000',
        outlineWidth: 2,  // in pixels
    };

    // Initialize text color preview
    const textColorPreview = document.getElementById('text-color-preview');
    const textColorInput = document.getElementById('text-color-input');
    const textEyedropperBtn = document.getElementById('text-eyedropper-btn');
    const textOpacitySlider = document.getElementById('text-opacity-slider');
    const textShadowEffect = document.getElementById('text-shadow-effect');
    const textMarkerEffect = document.getElementById('text-marker-effect');
    
    textColorPreview.style.backgroundColor = textOverlay.color;
    textColorInput.value = textOverlay.color;

    // Handle text input
    const titleInput = document.getElementById('title-input');
    const subtitleInput = document.getElementById('subtitle-input');
    const titleFontFamilySelect = document.getElementById('title-font-family-select');
    const subtitleFontFamilySelect = document.getElementById('subtitle-font-family-select');
    const titleFontWeightSelect = document.getElementById('title-font-weight-select');
    const subtitleFontWeightSelect = document.getElementById('subtitle-font-weight-select');
    const titleFontStyleSelect = document.getElementById('title-font-style-select');
    const subtitleFontStyleSelect = document.getElementById('subtitle-font-style-select');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const lineHeightSlider = document.getElementById('line-height-slider');
    const textXPositionSlider = document.getElementById('text-x-position-slider');
    const textYPositionSlider = document.getElementById('text-y-position-slider');

    // Add event listeners for text inputs
    titleInput.addEventListener('input', updateTextOverlay);
    subtitleInput.addEventListener('input', updateTextOverlay);
    titleFontFamilySelect.addEventListener('change', updateTextOverlay);
    subtitleFontFamilySelect.addEventListener('change', updateTextOverlay);
    titleFontWeightSelect.addEventListener('change', updateTextOverlay);
    subtitleFontWeightSelect.addEventListener('change', updateTextOverlay);
    titleFontStyleSelect.addEventListener('change', updateTextOverlay);
    subtitleFontStyleSelect.addEventListener('change', updateTextOverlay);
    fontSizeSlider.addEventListener('input', updateTextOverlay);
    lineHeightSlider.addEventListener('input', updateTextOverlay);
    textXPositionSlider.addEventListener('input', updateTextOverlay);
    textYPositionSlider.addEventListener('input', updateTextOverlay);
    textOpacitySlider.addEventListener('input', updateTextOverlay);
    textShadowEffect.addEventListener('click', updateTextOverlay);
    // Handle text color input
    textColorInput.addEventListener('input', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            textOverlay.color = color;
            textColorPreview.style.backgroundColor = color;
            updateTextOverlay();
        }
    });

    // Handle text eyedropper
    textEyedropperBtn.addEventListener('click', async () => {
        if (!window.EyeDropper) {
            alert('Your browser does not support the EyeDropper API');
            return;
        }

        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            textOverlay.color = result.sRGBHex;
            textColorInput.value = textOverlay.color;
            textColorPreview.style.backgroundColor = textOverlay.color;
            updateTextOverlay();
        } catch (e) {
            console.error('EyeDropper failed:', e);
        }
    });

    // Handle snap positions
    document.querySelectorAll('.snap-position-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const position = btn.dataset.position;
            switch (position) {
                case 'top':
                    textOverlay.yPosition = 10;
                    break;
                case 'upper-third':
                    textOverlay.yPosition = 33;
                    break;
                case 'center':
                    textOverlay.yPosition = 50;
                    break;
                case 'lower-third':
                    textOverlay.yPosition = 66;
                    break;
                case 'bottom':
                    textOverlay.yPosition = 90;
                    break;
            }
            textYPositionSlider.value = textOverlay.yPosition;
            updateTextOverlay();
        });
    });

    function updateTextOverlay() {
        textOverlay = {
            title: titleInput?.value || '',
            subtitle: subtitleInput?.value || '',
            titleFontFamily: titleFontFamilySelect?.value || 'Cabin Condensed',
            subtitleFontFamily: subtitleFontFamilySelect?.value || 'Cabin Condensed',
            titleFontWeight: titleFontWeightSelect?.value || '400',
            subtitleFontWeight: subtitleFontWeightSelect?.value || '400',
            titleFontStyle: titleFontStyleSelect?.value || 'normal',
            subtitleFontStyle: subtitleFontStyleSelect?.value || 'normal',
            color: textColorInput?.value || '#FFFFFF',
            opacity: textOpacitySlider ? parseInt(textOpacitySlider.value) : 100,
            dropShadow: textShadowEffect ? textShadowEffect.selected : true,
            markerEffect: textMarkerEffect ? textMarkerEffect.selected : true,
            fontSize: fontSizeSlider ? parseInt(fontSizeSlider.value) : 32,
            lineHeight: lineHeightSlider ? parseInt(lineHeightSlider.value) : 150,
            xPosition: textXPositionSlider ? parseInt(textXPositionSlider.value) : 50,
            yPosition: textYPositionSlider ? parseInt(textYPositionSlider.value) : 50,
            outlineColor: textOutlineColorInput?.value || '#000000',  // Reuse the existing input
            outlineWidth: 2,
        };
        
        if (selectedImageElement) {
            drawImageOnCanvas(selectedImageElement);
        }
    }

    // Add event listeners for text effects
    textOpacitySlider.addEventListener('input', (e) => {
        textOverlay.opacity = parseInt(e.target.value);
        updateTextOverlay();
    });

    textShadowEffect.addEventListener('click', () => {
        textOverlay.dropShadow = !textOverlay.dropShadow;
        updateTextOverlay();
    });

    const textHighlightEffect = document.getElementById('text-highlight-effect');
    const textHighlightColorInput = document.getElementById('text-highlight-color-input');
    const textHighlightColorGroup = document.querySelector('.text-highlight-color-group');
    const highlightEyedropperBtn = document.getElementById('highlight-eyedropper-btn');

    // Add null checks before adding event listeners
    if (textHighlightEffect) {
        textHighlightEffect.addEventListener('click', () => {
            if (textHighlightColorGroup) {
                textHighlightColorGroup.style.display = textHighlightEffect.selected ? 'flex' : 'none';
                if (textHighlightEffect.selected && textHighlightColorInput) {
                    textHighlightColorInput.value = '#FFE100'; // Set default highlight color
                }
            }
            updateTextOverlay();
        });
    }

    if (textHighlightColorInput) {
        textHighlightColorInput.addEventListener('input', () => {
            updateTextOverlay();
        });
    }

    if (highlightEyedropperBtn) {
        highlightEyedropperBtn.addEventListener('click', async () => {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                if (textHighlightColorInput) {
                    textHighlightColorInput.value = result.sRGBHex;
                }
                updateTextOverlay();
            } catch (error) {
                console.log('EyeDropper not supported or user canceled');
            }
        });
    }

    function hexToRGBA(hex, alpha = 1) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function drawTextOverlay() {
        if (!selectedImage) return;

        const ctx = previewCanvas.getContext('2d');
        const title = titleInput.value;
        const subtitle = subtitleInput.value;
        const fontSize = fontSizeSlider.value;
        const subtitleFontSize = fontSize * 0.7;
        const opacity = textOpacitySlider.value / 100;
        const highlightColor = textHighlightColorInput.value;
        const isHighlightActive = textHighlightEffect.selected;

        // Set text properties
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Calculate positions
        const xPos = (previewCanvas.width * textXPositionSlider.value) / 100;
        const yPos = (previewCanvas.height * textYPositionSlider.value) / 100;
        let currentY = yPos;

        // Draw title
        if (title) {
            ctx.font = `${titleFontStyleSelect.value} ${titleFontWeightSelect.value} ${fontSize}px "${titleFontFamilySelect.value}"`;
            ctx.fillStyle = hexToRGBA(textColorInput.value, opacity);
            
            if (isHighlightActive) {
                // Draw highlight background
                const titleMetrics = ctx.measureText(title);
                const padding = fontSize * 0.2;
                const highlightY = currentY - padding / 2;
                
                const gradient = ctx.createLinearGradient(xPos, highlightY, xPos + titleMetrics.width, highlightY);
                gradient.addColorStop(0, hexToRGBA(highlightColor, 0.1));
                gradient.addColorStop(0.04, hexToRGBA(highlightColor, 0.7));
                gradient.addColorStop(1, hexToRGBA(highlightColor, 0.3));
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(
                    xPos - padding,
                    highlightY,
                    titleMetrics.width + padding * 2,
                    fontSize + padding,
                    [fontSize * 0.4, fontSize * 0.15]
                );
                ctx.fill();
                
                // Draw text
                ctx.fillStyle = hexToRGBA(textColorInput.value, opacity);
            }

            if (textShadowEffect.selected) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }

            // if (textMarkerEffect.selected) {
            //     ctx.fillStyle = 'rgba(255,250,150,0.8)';
            //     ctx.fillRect(xPos, currentY - fontSize * 0.2, titleMetrics.width, fontSize);
            // }

            ctx.fillText(title, xPos, currentY);
            ctx.shadowColor = 'transparent';
            currentY += fontSize * (lineHeightSlider.value / 100);
        }

        // Draw subtitle
        if (subtitle) {
            ctx.font = `${subtitleFontStyleSelect.value} ${subtitleFontWeightSelect.value} ${subtitleFontSize}px "${subtitleFontFamilySelect.value}"`;
            ctx.fillStyle = hexToRGBA(textColorInput.value, opacity);

            if (isHighlightActive) {
                // Draw highlight background
                const subtitleMetrics = ctx.measureText(subtitle);
                const padding = subtitleFontSize * 0.2;
                const highlightY = currentY - padding / 2;
                
                const gradient = ctx.createLinearGradient(xPos, highlightY, xPos + subtitleMetrics.width, highlightY);
                gradient.addColorStop(0, hexToRGBA(highlightColor, 0.1));
                gradient.addColorStop(0.04, hexToRGBA(highlightColor, 0.7));
                gradient.addColorStop(1, hexToRGBA(highlightColor, 0.3));
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(
                    xPos - padding,
                    highlightY,
                    subtitleMetrics.width + padding * 2,
                    subtitleFontSize + padding,
                    [subtitleFontSize * 0.4, subtitleFontSize * 0.15]
                );
                ctx.fill();
                
                // Draw text
                ctx.fillStyle = hexToRGBA(textColorInput.value, opacity);
            }

            if (textShadowEffect.selected) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }

            // if (textMarkerEffect.selected) {
            //     ctx.fillStyle = 'rgba(255,250,150,0.15)';
            //     ctx.fillRect(xPos, currentY - subtitleFontSize * 0.2, subtitleMetrics.width, subtitleFontSize);
            // }

            ctx.fillText(subtitle, xPos, currentY);
            ctx.shadowColor = 'transparent';
        }
    }

    // Add after your existing initialization code
    const textOutlineColorPreview = document.getElementById('text-border-color-preview');
    const textOutlineColorInput = document.getElementById('text-border-color-input');
    const textOutlineEyedropperBtn = document.getElementById('text-border-eyedropper-btn');

    // Initialize outline color preview
    textOutlineColorPreview.style.backgroundColor = textOverlay.outlineColor;
    textOutlineColorInput.value = textOverlay.outlineColor;

    // Handle outline color input
    textOutlineColorInput.addEventListener('input', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            textOverlay.outlineColor = color;
            textOutlineColorPreview.style.backgroundColor = color;
            updateTextOverlay();
        }
    });

    // Handle outline color eyedropper
    textOutlineEyedropperBtn.addEventListener('click', async () => {
        if (!window.EyeDropper) {
            alert('Your browser does not support the EyeDropper API');
            return;
        }

        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            textOverlay.outlineColor = result.sRGBHex;
            textOutlineColorInput.value = textOverlay.outlineColor;
            textOutlineColorPreview.style.backgroundColor = textOverlay.outlineColor;
            updateTextOverlay();
        } catch (e) {
            console.error('EyeDropper failed:', e);
        }
    });

    function initializeEventListeners() {
        // Text input event listeners
        const titleInput = document.getElementById('title-input');
        const subtitleInput = document.getElementById('subtitle-input');
        const titleFontFamilySelect = document.getElementById('title-font-family-select');
        const subtitleFontFamilySelect = document.getElementById('subtitle-font-family-select');
        const titleFontWeightSelect = document.getElementById('title-font-weight-select');
        const subtitleFontWeightSelect = document.getElementById('subtitle-font-weight-select');
        const titleFontStyleSelect = document.getElementById('title-font-style-select');
        const subtitleFontStyleSelect = document.getElementById('subtitle-font-style-select');
        const fontSizeSlider = document.getElementById('font-size-slider');
        const lineHeightSlider = document.getElementById('line-height-slider');
        const textXPositionSlider = document.getElementById('text-x-position-slider');
        const textYPositionSlider = document.getElementById('text-y-position-slider');
        const textOpacitySlider = document.getElementById('text-opacity-slider');
        const textShadowEffect = document.getElementById('text-shadow-effect');
        const textMarkerEffect = document.getElementById('text-marker-effect');
        const textColorInput = document.getElementById('text-color-input');
        const textEyedropperBtn = document.getElementById('text-eyedropper-btn');

        // Add event listeners only if elements exist
        if (titleInput) titleInput.addEventListener('input', updateTextOverlay);
        if (subtitleInput) subtitleInput.addEventListener('input', updateTextOverlay);
        if (titleFontFamilySelect) titleFontFamilySelect.addEventListener('change', updateTextOverlay);
        if (subtitleFontFamilySelect) subtitleFontFamilySelect.addEventListener('change', updateTextOverlay);
        if (titleFontWeightSelect) titleFontWeightSelect.addEventListener('change', updateTextOverlay);
        if (subtitleFontWeightSelect) subtitleFontWeightSelect.addEventListener('change', updateTextOverlay);
        if (titleFontStyleSelect) titleFontStyleSelect.addEventListener('change', updateTextOverlay);
        if (subtitleFontStyleSelect) subtitleFontStyleSelect.addEventListener('change', updateTextOverlay);
        if (fontSizeSlider) fontSizeSlider.addEventListener('input', updateTextOverlay);
        if (lineHeightSlider) lineHeightSlider.addEventListener('input', updateTextOverlay);
        if (textXPositionSlider) textXPositionSlider.addEventListener('input', updateTextOverlay);
        if (textYPositionSlider) textYPositionSlider.addEventListener('input', updateTextOverlay);
        if (textOpacitySlider) textOpacitySlider.addEventListener('input', updateTextOverlay);
        if (textShadowEffect) textShadowEffect.addEventListener('click', updateTextOverlay);

        // Handle text color input
        if (textColorInput) {
            textColorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                if (/^#[0-9A-F]{6}$/i.test(color)) {
                    textOverlay.color = color;
                    if (textColorPreview) textColorPreview.style.backgroundColor = color;
                    updateTextOverlay();
                }
            });
        }

        // Handle text eyedropper
        if (textEyedropperBtn) {
            textEyedropperBtn.addEventListener('click', async () => {
                if (!window.EyeDropper) {
                    alert('Your browser does not support the EyeDropper API');
                    return;
                }

                try {
                    const eyeDropper = new EyeDropper();
                    const result = await eyeDropper.open();
                    textOverlay.color = result.sRGBHex;
                    if (textColorInput) textColorInput.value = textOverlay.color;
                    if (textColorPreview) textColorPreview.style.backgroundColor = textOverlay.color;
                    updateTextOverlay();
                } catch (e) {
                    console.error('EyeDropper failed:', e);
                }
            });
        }

        // Initialize snap positions
        document.querySelectorAll('.snap-position-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const position = btn.dataset.position;
                switch (position) {
                    case 'top':
                        textOverlay.yPosition = 10;
                        break;
                    case 'upper-third':
                        textOverlay.yPosition = 33;
                        break;
                    case 'center':
                        textOverlay.yPosition = 50;
                        break;
                    case 'lower-third':
                        textOverlay.yPosition = 66;
                        break;
                    case 'bottom':
                        textOverlay.yPosition = 90;
                        break;
                }
                if (textYPositionSlider) textYPositionSlider.value = textOverlay.yPosition;
                updateTextOverlay();
            });
        });
    }

    // Call the initialization function after DOM content is loaded
    document.addEventListener('DOMContentLoaded', () => {
        // ... (rest of your initialization code)

        // Initialize event listeners
        initializeEventListeners();
    });
}); 