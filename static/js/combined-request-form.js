    // ===================================
    // Constants and Configuration
    // ===================================

    const API_CONFIG = {
        baseUrl: 'https://uvarc-unified-service.pods.uvarc.io/uvarc/api/resource/rcwebform/user',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': window.location.origin
        }
    };
    
    const RESOURCE_TYPES = {
        'Standard': { 
            isPaid: false, // Free allocation
            description: 'Standard allocation for research projects',
            category: 'Rivanna HPC'
        },
        'Paid': { 
            isPaid: true, // Paid allocation
            description: 'Paid allocation for additional computing needs',
            category: 'Rivanna HPC'
        },
        'Instructional': { 
            isPaid: false, // Free for educational use
            description: 'Allocation for teaching and educational purposes',
            category: 'Rivanna HPC'
        },
        'SSZ Research Project': { 
            isPaid: true, // Always paid
            description: 'High-performance project storage',
            category: 'Storage'
        },
        'SSZ Research Standard': { 
            isPaid: (currentSize) => currentSize > 10, // Free up to 10TB
            freeLimit: 10,
            description: 'Standard research storage (first 10TB free)',
            category: 'Storage'
        },
        'Highly Sensitive Data': {
            isPaid: true, // Always paid
            description: 'Secure storage for sensitive data',
            category: 'Storage'
        }
    };

    // ===================================
    // Fetches and Holds API Data
    // ===================================

    let apiMetadata = {};

    let consoleData = [];

    // ===================================
    // CSS Styles
    // ===================================

    $('<style>')
        .text(`
            .group-dropdown option {
                padding: 8px;
                margin: 2px;
                border-radius: 4px;
            }
            .group-dropdown option.text-muted { 
                color: #6c757d !important;
                background-color: #f8f9fa;
            }
            .group-dropdown option:disabled {
                color: #adb5bd !important;
                font-style: italic;
                background-color: #f8f9fa !important;
                cursor: not-allowed;
            }
            .api-error-message {
                margin-bottom: 1rem;
                padding: 1rem;
                border-radius: 0.25rem;
                border: 1px solid #f5c6cb;
                background-color: #f8d7da;
                color: #721c24;
            }
        `)
        .appendTo('head');

    // ===================================
    // Validation Patterns
    // ===================================

    const VALIDATION = {
        groupName: /^[a-zA-Z0-9\-_]+$/,
        projectName: /^[\w\-\s]{3,128}$/,
        sharedSpaceName: /^[\w\-]{3,40}$/
    };

    // ===================================
    // Utility and Helper Functions
    // ===================================

        /// Get UserID

        function getUserId() {
            const userId = $('#uid').val() || "Unknown"; // Fetch the user ID dynamically
            if (userId === "Unknown") {
                console.error("User ID is not available. Please ensure you are logged in.");
                showErrorMessage("Failed to retrieve user information. Please log in and refresh the page.");
                throw new Error("User ID is unknown.");
            }
            console.log("User ID:", userId);
            return userId;
        }

        /// Core Helper Functions

        function markFieldValid($field) {
            console.log(`Marking field valid: ${$field.attr('id') || $field.attr('name')}`);
            $field.addClass('is-valid').removeClass('is-invalid');
            $field.siblings('.invalid-feedback').remove();
        }
        
        function markFieldInvalid($field, message) {
            console.log(`Marking field invalid: ${$field.attr('id') || $field.attr('name')}, Reason: ${message}`);
            $field.addClass('is-invalid').removeClass('is-valid');
            
            let $feedback = $field.siblings('.invalid-feedback');
            if ($feedback.length === 0) {
                $feedback = $('<div>')
                    .addClass('invalid-feedback')
                    .text(message);
                $field.after($feedback);
            } else {
                $feedback.text(message);
            }
        }

        function validateField($field) {
            if (!$field.is(':visible')) {
                return true; // Skip validation for hidden fields
            }
        
            const isCheckbox = $field.is(':checkbox');
            const isDropdown = $field.is('select');
        
            if (isCheckbox) {
                if (!$field.is(':checked')) {
                    markFieldInvalid($field, 'This field is required.');
                    return false;
                }
            } else if (isDropdown) {
                if (!$field.val() || $field.val().trim() === '') {
                    markFieldInvalid($field, 'Please select an option.');
                    return false;
                }
            } else {
                if (!$field.val()?.trim()) {
                    markFieldInvalid($field, 'This field is required.');
                    return false;
                }
            }
        
            markFieldValid($field);
            return true;
        }

        /// Fetch Metadata

        async function fetchMetadata() {
            const userId = getUserId(); // Dynamically fetch the UserID
            const metadataUrl = `${API_CONFIG.baseUrl}/${userId}`; // Construct the correct URL
        
            const loadingMessage = $('<div>')
                .addClass('alert alert-info d-flex align-items-center')
                .attr('id', 'loading-metadata')
                .html(`
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading Resources...</span>
                    </div>
                    ...Please wait.
                `)
                .prependTo('#combined-request-form');
        
            try {
                const response = await fetch(metadataUrl, {
                    method: 'GET',
                    headers: {
                        ...API_CONFIG.headers,
                        'Origin': window.location.origin, // Dynamically include origin
                    },
                    credentials: 'include'
                });
        
                if (!response.ok) {
                    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
                }
        
                const metadata = await response.json();
                console.log("Fetched metadata:", metadata);
                return metadata;
            } catch (error) {
                console.error("Error fetching metadata:", error);
        
                // Retry logic
                for (let attempt = 1; attempt <= 3; attempt++) {
                    console.log(`Retrying metadata fetch (Attempt ${attempt})...`);
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between retries
        
                    try {
                        const response = await fetch(metadataUrl, {
                            method: 'GET',
                            headers: {
                                ...API_CONFIG.headers,
                                'Origin': window.location.origin,
                            },
                            credentials: 'include'
                        });
        
                        if (response.ok) {
                            const metadata = await response.json();
                            console.log("Fetched metadata on retry:", metadata);
                            return metadata;
                        }
                    } catch (retryError) {
                        console.warn(`Retry ${attempt} failed.`);
                    }
                }
        
                throw new Error('Failed to load metadata after multiple attempts.');
            } finally {
                loadingMessage.remove(); // Remove the loading message
            }
        }

        /// Update Form Using Metadata

        function updateFormUsingMetadata(metadata) {
            if (!metadata || typeof metadata !== 'object') {
                console.warn("No valid metadata available to update the form.");
                return;
            }
        
            // Example: Update capacity limits based on metadata
            const storageLimits = metadata.storageTiers || {};
            Object.keys(storageLimits).forEach(tier => {
                const limits = storageLimits[tier];
                $(`#${tier}-capacity`).attr('max', limits.max || 200);
            });
        
            // Example: Populate tier-specific descriptions
            const allocationDescriptions = metadata.allocationTiers || {};
            Object.keys(allocationDescriptions).forEach(tier => {
                const description = allocationDescriptions[tier].description || "No description available.";
                $(`#${tier}-description`).text(description);
            });
        
            console.log("Form updated using metadata:", metadata);
        }

        /// Session and Data Handling

        async function waitForUserSession() {
            let attempts = 0;
            const maxAttempts = 50;
            
            while (attempts < maxAttempts) {
                const userIdField = document.querySelector('input[name="uid"]') || 
                                document.querySelector('#uid');
                
                if (userIdField && userIdField.value) {
                    console.log("User ID found:", userIdField.value);
                    return userIdField.value;
                }
                
                if (attempts % 10 === 0) {
                    console.log(`Waiting for user session... Attempt ${attempts}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            throw new Error('Could not get user ID - please ensure you are logged in');
        }

        function collectFormData() {
            const formData = {
                requestType: $('input[name="request-type"]:checked').val(),
                group: $('#mygroups-group').val(),
                projectName: $('#new-project-name').val(),
                capacity: $('#capacity').val(),
                allocationTier: $('input[name="allocation-choice"]:checked').val(),
                storageTier: $('input[name="storage-choice"]:checked').val(),
                shouldShowBilling: $('#billing-information').is(':visible'),
            };
        
            if (formData.requestType === 'service-unit') {
                formData.newOrRenewal = $('input[name="new-or-renewal"]:checked').val();
                if (formData.newOrRenewal === 'renewal') {
                    formData.existingProject = $('input[name="existing-project-allocation"]:checked').val();
                }
            } else if (formData.requestType === 'storage') {
                formData.typeOfRequest = $('input[name="type-of-request"]:checked').val();
                if (formData.typeOfRequest !== 'new-storage') {
                    formData.existingProject = $('input[name="existing-project-storage"]:checked').val();
                }
            }
        
            return formData;
        }

        /// Enum Mappings

        function getTierEnum(tier) {
            const tierMap = {
                'Standard': 'ssz_standard',
                'Instructional': 'ssz_instructional',
                'Paid': 'ssz_paid',
            };
            return tierMap[tier] || 'ssz_standard';
        }

        function getStorageTierEnum(tier) {
            const tierMap = {
                'SSZ Research Standard': 'ssz_standard',
                'SSZ Research Project': 'ssz_project',
                'Highly Sensitive Data': 'hsz_standard',
            };
            return tierMap[tier] || 'ssz_standard'; // Default to 'ssz_standard' if no match
        }

        /// Utils Object

        const utils = {
            formatBytes: (bytes, decimals = 2) => {
                if (bytes === 0) return '0 TB';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['TB', 'PB', 'EB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            },
            
            validateGroupName: (name) => {
                return VALIDATION.groupName.test(name);
            },
        
            validateProjectName: (name) => {
                return VALIDATION.projectName.test(name);
            },
        
            validateSharedSpaceName: (name) => {
                return VALIDATION.sharedSpaceName.test(name);
            },
        
            isTierPaid: (tierName, currentSize = 0) => {
                const tier = RESOURCE_TYPES[tierName];
                if (!tier) return false;
                
                if (typeof tier.isPaid === 'function') {
                    return tier.isPaid(currentSize);
                }
                return tier.isPaid;
            },
        
            handleApiResponse: async (response) => {
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                const data = await response.json();
                console.log('API Response:', data);
                return data;
            },
        
            logApiError: (error, context) => {
                console.error(`API Error (${context}):`, error);
                return error;
            },
        
            showWaitingMessage: () => {
                return $('<div>')
                    .addClass('api-waiting-message')
                    .html(`
                        <div class="d-flex align-items-center">
                            <div class="spinner-border spinner-border-sm me-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <div>Loading your groups...</div>
                        </div>
                    `)
                    .prependTo('#combined-request-form');
            },
        
            removeWaitingMessage: () => {
                $('.api-waiting-message').remove();
            }
        }
    
        /// Send Email to User

        function sendUserEmail(email, payload) {
            const emailSubject = "Your Resource Request Submission";
            const emailBody = `
                Hello,
        
                Thank you for submitting your request. Here are the details:
        
                ${JSON.stringify(payload, null, 2).replace(/[$begin:math:display$$end:math:display$]/g, '')}
        
                Best regards,
                Research Computing Team
            `;
        
            // Simulate sending email (replace with API call for production)
            console.log(`Simulating email to ${email}`);
            console.log(`Subject: ${emailSubject}`);
            console.log(`Body:\n${emailBody}`);
        }

        /// Clear Form Fields

        function clearFormFields() {
            const $form = $('#combined-request-form');
            $form[0].reset(); // Reset all form fields
            $form.find('.is-valid, .is-invalid').removeClass('is-valid is-invalid'); // Remove validation styles
            $form.find('.invalid-feedback').remove(); // Remove error messages
            updateFormValidation(); // Revalidate to disable the submit button
            console.log("Form fields cleared.");
        }

        /// Success Message

        function showErrorMessage(message) {
            const errorDiv = $('<div>').addClass('alert alert-danger').text(message);
            $('#combined-request-form').prepend(errorDiv);
            setTimeout(() => errorDiv.remove(), 10000); // Set consistent timeout
        }
        
        function showSuccessMessage(message) {
            const successDiv = $('<div>')
                .addClass('alert alert-success alert-dismissible fade show')
                .attr('role', 'alert')
                .html(`
                    ${message}
                    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                `);
        
            $('#combined-request-form').prepend(successDiv);
            $('html, body').animate({ scrollTop: 0 }, 'slow');
            setTimeout(() => successDiv.remove(), 10000); // Set consistent timeout
        }

    // ===================================
    // Error Handling
    // ===================================

    function showErrorMessage(message) {
        const errorDiv = $('<div>').addClass('alert alert-danger').text(message);
        $('#combined-request-form').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 10000); // Set consistent timeout
    }

    function handleApiError(error) {
        const message = `There was an error processing your request. (${error.message || "Unknown error"})`;
        console.error("API Error:", error);
        $('#combined-request-form').prepend(
            $('<div>')
                .addClass('alert alert-danger')
                .text(message)
        );
    }
    
    function logApiError(error, context) {
        console.error(`API Error (${context}):`, error);
    }

    // ===================================
    // UI Toggles
    // ===================================

    function toggleRequestFields() {
        const requestType = $('input[name="request-type"]:checked').val();

        // Show common fields
        $('#common-fields').show();

        // Explicitly show or hide primary sections
        if (requestType === 'service-unit') {
            $('#allocation-fields').show();
            $('#storage-fields').hide();
            toggleAllocationFields(); // Handle nested toggles for service-unit
        } else if (requestType === 'storage') {
            $('#allocation-fields').hide();
            $('#storage-fields').show();
            toggleStorageFields(); // Handle nested toggles for storage
        } else {
            // Default case: hide both sections
            $('#allocation-fields, #storage-fields').hide();
        }
    }

    function toggleAllocationFields() {
        const isNew = $('#new-or-renewal-options input[name="new-or-renewal"]:checked').val() === 'new';

        // Explicitly show or hide new vs renewal fields
        if (isNew) {
            $('#allocation-fields #new-project-name-container, #allocation-fields #project-description, #allocation-fields #mygroups-group-container, #allocation-fields #allocation-tier').show();
            $('#allocation-fields #existing-projects-allocation').hide();
        } else {
            $('#allocation-fields #new-project-name-container, #allocation-fields #project-description, #allocation-fields #mygroups-group-container, #allocation-fields #allocation-tier').hide();
            $('#allocation-fields #existing-projects-allocation').show();
        }
    }

    function toggleStorageFields() {
        const isNewStorage = $('#storage-fields input[name="type-of-request"]:checked').val() === 'new-storage';

        // Explicitly show or hide new vs existing storage fields
        if (isNewStorage) {
            $('#storage-fields #storage-mygroups-container, #storage-fields #storage-capacity, #storage-fields #storage-platform, #storage-fields #shared-space-name-container, #storage-fields #project-title-container').show();
            $('#storage-fields #existing-projects-storage').hide();
        } else {
            $('#storage-fields #storage-mygroups-container, #storage-fields #storage-capacity, #storage-fields #storage-platform, #storage-fields #shared-space-name-container, #storage-fields #project-title-container').hide();
            $('#storage-fields #existing-projects-storage').show();
        }
    }

    function toggleStorageTierOptions() {
        const isHighlySensitive = $('#storage-tier-options input[name="storage-choice"]:checked').val() === 'Highly Sensitive Data';

        // Explicitly show or hide tier-specific sections
        if (isHighlySensitive) {
            $('#storage-tier-options #sensitive-data').show();
            $('#storage-tier-options #standard-data').hide();
        } else {
            $('#storage-tier-options #sensitive-data').hide();
            $('#storage-tier-options #standard-data').show();
        }
    }

    // ===================================
    // Setup Event Handlers
    // ===================================

    function setupEventHandlers() {
        // Use event delegation for dynamically added inputs
        $(document).on('change', 'input[name="request-type"]', toggleRequestFields);
        $(document).on('change', 'input[name="new-or-renewal"]', toggleAllocationFields);
        $(document).on('change', 'input[name="type-of-request"]', toggleStorageFields);
        $(document).on('change', 'input[name="storage-choice"]', toggleStorageTierOptions);
    
        // General input, select, and textarea validation and updates
        $(document).on('input change', '#combined-request-form input, #combined-request-form select, #combined-request-form textarea', function () {
            updatePayloadPreview(); // Update the real-time payload preview
            updateBillingVisibility(); // Update billing visibility
        });
    
        // Attach submit event handler
        $(document).on('submit', '#combined-request-form', handleFormSubmit);
    }
    
    // ===================================
    // Submission Handlers
    // ===================================

    async function handleFormSubmit(event) {
        event.preventDefault(); // Prevent default form submission
    
        console.log("Form submission triggered.");
    
        const formData = collectFormData(); // Collect data from the form
        const payload = buildPayloadPreview(); // Build payload for submission
        const errors = validatePayload(payload); // Validate the payload
    
        // Verify payload before submission
        console.log("Final Payload Before Submission:", JSON.stringify(payload, null, 2));
    
        if (errors.length > 0) {
            displayValidationErrors(errors);
            return; // Stop submission on validation errors
        }
    
        try {
            const responseData = await submitForm(formData, payload);
    
            // Log API response after submission
            console.log("API Response:", responseData);
    
        } catch (error) {
            console.error("Error during form submission:", error);
            showErrorMessage("An error occurred while submitting the form. Please try again.");
        }
    }
    
    // ===================================
    // Error Handlers
    // ===================================

    function displayValidationErrors(errors) {
        const errorDiv = $('<div>')
            .addClass('alert alert-danger')
            .html(`
                <strong>Validation Errors:</strong>
                <ul>${errors.map(err => `<li>${err}</li>`).join('')}</ul>
            `);
        $('#combined-request-form').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 10000); // Remove after 10 seconds
        console.error("Validation errors:", errors);
    }
    
    // ===================================
    // Submit Form
    // ===================================

    async function submitForm(formData, payload) {
        const userId = getUserId();
        const userEmail = `${userId}@virginia.edu`; // Construct the user's email
        console.log("Submitting payload for user:", userId);
        console.log("User email:", userEmail);
    
        const method = formData.isUpdate ? 'PUT' : 'POST'; // Determine HTTP method dynamically
    
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/${userId}`, {
                method: method,
                headers: {
                    ...API_CONFIG.headers, // Use existing headers
                },
                body: JSON.stringify(payload),
                // credentials: 'include',
                // Remove credentials to test
            });
    
            // Log raw API response
            console.log(`Raw API Response (${method}):`, response);

            // Log the response text to check for error details
            const responseText = await response.text(); 
            console.log(`API Response Text: ${responseText}`);
    
            if (!response.ok) {
                const errorMessage = await response.text();
                console.error(`Submission failed (${method}):`, errorMessage);
                showErrorMessage("Submission failed. Please try again.");
                return;
            }
    
            const responseData = await response.json();
    
            // Log parsed API response data
            console.log(`Form ${method === 'PUT' ? 'updated' : 'submitted'} successfully:`, responseData);
    
            // Email the user with the submitted information
            sendUserEmail(userEmail, payload);
    
            // Clear the form fields
            clearFormFields();
    
            // Display success message and scroll to the top
            showSuccessMessage("Your request has been submitted successfully!");
    
            return responseData; // Return response for logging in `handleFormSubmit`
        } catch (error) {
            console.error("Error during form submission:", error);
            showErrorMessage("An error occurred while submitting the form. Please try again.");
        }
    }

    // ===================================
    // Capacity and Visibility
    // ===================================
    
    function updateCapacityLimits(tierType) {
        const capacityField = $('#capacity');
    
        if (!apiMetadata || !apiMetadata.storageTiers) {
            console.warn("No metadata available for capacity limits.");
            return;
        }
    
        const tierData = apiMetadata.storageTiers[tierType];
        if (tierData) {
            capacityField.attr('max', tierData.max || 200);
            console.log(`Updated capacity limits for ${tierType}:`, tierData);
        } else {
            console.warn(`No limits found for storage tier: ${tierType}`);
        }
    }

    function updateBillingVisibility() {
        const requestType = $('input[name="request-type"]:checked').val();
        const selectedStorageTier = $('input[name="storage-choice"]:checked').val();
        const requestedStorageSize = parseInt($('#capacity').val(), 10) || 0;
    
        let shouldShowBilling = true; // Default to show billing
    
        if (requestType === 'storage') {
            if (selectedStorageTier === "SSZ Research Standard") {
                const freeLimit = RESOURCE_TYPES["SSZ Research Standard"].freeLimit || 10;
                shouldShowBilling = requestedStorageSize > freeLimit; // Show billing only if above the free limit
            }
        }
    
        $('#billing-information').toggle(shouldShowBilling);
        console.log(`Billing visibility updated: ${shouldShowBilling}`);
    }

    function getBillingDetails() {
        const financialContact = $('#financial-contact').val()?.trim() || '';
        const companyId = $('#company-id').val()?.trim() || '';
        const costCenter = $('#cost-center').val()?.trim() || '';
        const businessUnit = $('#business-unit').val()?.trim() || '';
        const fundingType = $('input[name="funding-type"]:checked').val() || '';
        const fundingNumber = $('#funding-number').val()?.trim() || '';
        const fund = $('#fund').val()?.trim() || '';
        const functionCode = $('#function').val()?.trim() || '';
        const program = $('#program').val()?.trim() || '';
        const activity = $('#activity').val()?.trim() || '';
        const assignee = $('#assignee').val()?.trim() || '';
    
        return {
            fdm_billing_info: [
                {
                    financial_contact: financialContact,
                    company: companyId,
                    business_unit: businessUnit,
                    cost_center: costCenter,
                    fund: fund,
                    gift: fundingType === 'Gift' ? fundingNumber : '',
                    grant: fundingType === 'Grant' ? fundingNumber : '',
                    designated: fundingType === 'Designated' ? fundingNumber : '',
                    project: fundingType === 'Project' ? fundingNumber : '',
                    program_code: program,
                    function: functionCode,
                    activity: activity,
                    assignee: assignee,
                }
            ]
        };
    }

    // ===================================
    // Real-Time Payload Preview
    // ===================================

    function setupPayloadPreviewUpdater() {
        $('#combined-request-form input, #combined-request-form select, #combined-request-form textarea')
            .on('input change', function () {
                updatePayloadPreview();
            });
        console.log("Payload preview updater initialized.");
    }

    // Store previous payload and errors to reduce redundant logs
    let previousPayloadString = "";
    let previousErrorsString = "";

    function updatePayloadPreview() {
        const payload = buildPayloadPreview();
        const errors = validatePayload(payload);

        // Convert to JSON strings for comparison
        const payloadString = JSON.stringify(payload, null, 2);
        const errorsString = JSON.stringify(errors, null, 2);

        // Only log if the payload has changed
        if (payloadString !== previousPayloadString) {
            console.clear(); // Clears the console to reduce clutter
            console.log("✅ Updated Payload Preview:", payload);
            previousPayloadString = payloadString;
        }

        // Only log errors if they have changed
        if (errorsString !== previousErrorsString) {
            if (errors.length > 0) {
                console.warn("Validation Errors:", errors);
            } else {
                console.log("Payload is valid.");
            }
            previousErrorsString = errorsString;
        }
    }

    function buildPayloadPreview() {
        const formData = collectFormData();
        const userId = getUserId();
    
        // Convert group_name and user_groups to lowercase
        const groupName = formData.group ? formData.group.toLowerCase() : "";
        
        // The API expects an array at the root level
        const payload = [
            {
                "group_name": groupName,  // Ensure lowercase group name
                "user_groups": [groupName],  // Ensure user_groups is lowercase
                "project_name": formData.projectName?.trim() || "",
                "project_desc": $('#project-description').val()?.trim() || "",
                "data_agreement_signed": $('#data-agreement').is(':checked'),
                "pi_uid": userId,
                "resources": {
                    "hpc_service_units": {},
                    "storage": {}
                }
            }
        ];
    
        // If the request type is "service-unit", populate hpc_service_units
        if (formData.requestType === 'service-unit') {
            const key = `${groupName}-ssz_standard`;  // Dynamically generate the key
            payload[0].resources.hpc_service_units[key] = {
                "tier": getTierEnum(formData.allocationTier),
                "request_count": formData.requestCount || "1000",
                "request_date": new Date().toISOString(),
                "request_status": "pending",
                "update_date": new Date().toISOString(),
                "billing_details": getBillingDetails()  // Fetch billing details dynamically
            };
        }
    
        // If the request type is "storage", populate storage resources
        if (formData.requestType === 'storage') {
            const storageKey = `${groupName}-ssz_standard`;
            payload[0].resources.storage[storageKey] = {
                "tier": "ssz_standard",
                "request_size": formData.capacity || "1000",
                "billing_details": getBillingDetails()  // Attach billing details dynamically
            };
        }
    
        console.log("✅ Final Payload Before Submission:", JSON.stringify(payload, null, 2));
        return payload;
    }

    function validatePayload(payload) {
        const errors = [];
    
        // Ensure payload is an array
        if (!Array.isArray(payload) || payload.length === 0) {
            errors.push("Payload must be a non-empty array.");
            return errors;
        }
    
        // Validate each user resource in the array
        payload.forEach((resource, index) => {
            const resourceLabel = `Resource ${index + 1}`;
    
            // Ensure group_name exists and is lowercase
            if (!resource.group_name || typeof resource.group_name !== "string" || resource.group_name.trim() === "") {
                errors.push(`${resourceLabel}: Group name is required and must be a lowercase string.`);
            } else if (resource.group_name !== resource.group_name.toLowerCase()) {
                errors.push(`${resourceLabel}: Group name must be lowercase.`);
            }
    
            // Ensure user_groups is an array containing the lowercase group name
            if (!Array.isArray(resource.user_groups) || resource.user_groups.length === 0) {
                errors.push(`${resourceLabel}: User groups must be a non-empty array.`);
            } else if (resource.user_groups.some(g => g !== g.toLowerCase())) {
                errors.push(`${resourceLabel}: All user group names must be lowercase.`);
            }
    
            // Ensure project_name exists
            if (!resource.project_name || resource.project_name.trim() === "") {
                errors.push(`${resourceLabel}: Project name is required.`);
            }
    
            // Ensure PI UID is present
            if (!resource.pi_uid || resource.pi_uid.trim() === "") {
                errors.push(`${resourceLabel}: PI UID (user ID) is required.`);
            }
    
            // Ensure data agreement is signed
            if (typeof resource.data_agreement_signed !== "boolean") {
                errors.push(`${resourceLabel}: Data agreement signed field must be true or false.`);
            }
    
            // Ensure "resources" exist
            if (!resource.resources || typeof resource.resources !== "object") {
                errors.push(`${resourceLabel}: Resources section is missing.`);
                return;
            }
    
            // Validate HPC service units
            if (resource.resources.hpc_service_units && Object.keys(resource.resources.hpc_service_units).length > 0) {
                Object.entries(resource.resources.hpc_service_units).forEach(([key, unit]) => {
                    if (!unit.request_count || isNaN(parseInt(unit.request_count))) {
                        errors.push(`${resourceLabel} - Service Unit ${key}: Request count must be a valid number.`);
                    }
                    if (!unit.tier || unit.tier.trim() === "") {
                        errors.push(`${resourceLabel} - Service Unit ${key}: Tier is required.`);
                    }
                    if (!unit.billing_details || !unit.billing_details.fdm_billing_info || unit.billing_details.fdm_billing_info.length === 0) {
                        errors.push(`${resourceLabel} - Service Unit ${key}: Billing details are required.`);
                    }
                });
            }
    
            // Validate Storage Requests
            if (resource.resources.storage && Object.keys(resource.resources.storage).length > 0) {
                Object.entries(resource.resources.storage).forEach(([key, storage]) => {
                    if (!storage.request_size || isNaN(parseInt(storage.request_size))) {
                        errors.push(`${resourceLabel} - Storage ${key}: Request size must be a valid number.`);
                    }
                    if (!storage.tier || storage.tier.trim() === "") {
                        errors.push(`${resourceLabel} - Storage ${key}: Tier is required.`);
                    }
                    if (!storage.billing_details || !storage.billing_details.fdm_billing_info || storage.billing_details.fdm_billing_info.length === 0) {
                        errors.push(`${resourceLabel} - Storage ${key}: Billing details are required.`);
                    }
                });
            }
        });
    
        return errors; // Return errors for form validation
    }

    // ===================================
    // Fetch and Populate Groups
    // ===================================

    async function fetchAndPopulateGroups() {
        // Show a waiting message (use utility function if available)
        const waitingMessage = utils?.showWaitingMessage?.() || $('<div>').text('Loading...').prependTo('#combined-request-form');
        
        try {
            // Dynamically fetch the user ID using the helper function
            const userId = getUserId(); 
            console.log(`Attempting API call for user: ${userId}`);
            
            // Construct the API request URL
            const requestUrl = `${API_CONFIG.baseUrl}/${userId}`;
            console.log("Request URL:", requestUrl);
    
            // Define headers dynamically, including the current origin
            const headers = {
                ...API_CONFIG.headers,
                'Origin': window.location.origin // Dynamically set the origin
            };
    
            // Perform the fetch call with credentials included
            const response = await fetch(requestUrl, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
    
            // Handle non-OK responses
            if (!response.ok) {
                const errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
                console.error(errorMessage);
                handleApiError(new Error(errorMessage));
                return;
            }
    
            // Parse the JSON response
            const jsonResponse = await response.json();
            consoleData = jsonResponse; // Save to global variable for further use
            console.log("Fetched groups and resources:", consoleData);
    
            // Parse and populate user groups and resources
            const { userGroups, userResources } = parseConsoleData(jsonResponse);
    
            // Populate dropdowns for user groups
            if (Array.isArray(userGroups) && userGroups.length > 0) {
                console.log("Populating user groups:", userGroups);
                populateGrouperMyGroupsDropdown(userGroups);
            } else {
                console.warn("No user groups found.");
                populateGrouperMyGroupsDropdown([]);
            }
    
            // Process user resources if available
            if (Array.isArray(userResources) && userResources.length > 0) {
                console.log("Processing user resources...");
                processUserResources(jsonResponse);
            } else {
                console.warn("No user resources found.");
            }
        } catch (error) {
            console.error("Error fetching user groups:", error);
            handleApiError(error); // Display a user-friendly error message
        } finally {
            // Remove the waiting message
            utils?.removeWaitingMessage?.() || waitingMessage.remove();
        }
    }

    // ===================================
    // Resource Processing Functions
    // ===================================

    function parseConsoleData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            console.error("Invalid consoleData format or empty data:", data);
            return { userGroups: [], userResources: [] };
        }
    
        const userGroups = data[0]?.user_groups || [];
        const userResources = (() => {
            try {
                return typeof data[0]?.user_resources === 'string'
                    ? JSON.parse(data[0]?.user_resources)
                    : data[0]?.user_resources || [];
            } catch (error) {
                console.error("Error parsing user_resources:", error);
                return [];
            }
        })();
    
        console.log("Parsed user groups:", userGroups);
        console.log("Parsed user resources:", userResources);
    
        return { userGroups, userResources };
    }

    function populateGrouperMyGroupsDropdown(groups) {
        const $dropdowns = $('#mygroups-group, #storage-mygroups-group');
    
        $dropdowns.each(function () {
            const $dropdown = $(this);
            
            // Save the current selected value
            const currentValue = $dropdown.val();
    
            // Clear existing options but retain the placeholder
            $dropdown.empty();
            $dropdown.append(
                $('<option>', {
                    value: '',
                    text: '- Select a group -',
                    selected: true,
                    disabled: true
                })
            );
    
            console.log(`Populating dropdown: ${$dropdown.attr('id')} with groups:`, groups);
    
            if (groups.length) {
                groups.forEach(group => {
                    const groupName = typeof group === 'string' ? group : group.name;
                    const option = $('<option>', {
                        value: groupName.trim(),
                        text: groupName.trim(),
                    });
    
                    // Restore previous selection if the value exists
                    if (groupName.trim() === currentValue) {
                        option.prop('selected', true);
                    }
    
                    $dropdown.append(option);
                });
    
                $dropdown.prop('disabled', false);
            } else {
                console.warn("No groups found to populate.");
                $dropdown.append(
                    $('<option>', {
                        value: '',
                        text: 'No groups available - contact support',
                        disabled: true,
                    })
                );
                $dropdown.prop('disabled', true);
            }
    
            // Trigger change event for validation or dependent logic
            $dropdown.trigger('change');
        });
    
        console.log('Dropdowns populated successfully.');
    }

    function createResourceRow({ type, group, tier, details }) {
        return `
            <tr>
                <td>${type}</td>
                <td>${group}</td>
                <td>${tier}</td>
                <td>${details}</td>
            </tr>
        `;
    }

    function processUserResources(apiResponse) {
        const { userResources } = parseConsoleData(apiResponse);
        const previewTableBody = $('#combined-preview-tbody');
        previewTableBody.empty();
    
        if (!Array.isArray(userResources) || userResources.length === 0) {
            showEmptyState(previewTableBody);
            return;
        }
    
        userResources.forEach(resource => {
            if (resource.resources?.hpc_service_units) {
                Object.entries(resource.resources.hpc_service_units).forEach(([allocationName, details]) => {
                    const row = createResourceRow({
                        type: 'Service Units',
                        group: resource.group_name,
                        tier: details.tier,
                        details: `${details.request_count || 0} SUs | Updated: ${details.update_date}`
                    });
                    previewTableBody.append(row);
                });
            }
    
            if (resource.resources?.storage) {
                Object.entries(resource.resources.storage).forEach(([storageName, details]) => {
                    const row = createResourceRow({
                        type: 'Storage',
                        group: resource.group_name,
                        tier: details.tier,
                        details: `${details.request_size || 0}TB | Updated: ${details.update_date}`
                    });
                    previewTableBody.append(row);
                });
            }
        });
    }

    // ===================================
    // Update Form Validation
    // ===================================

    function updateFormValidation() {
        const $form = $('#combined-request-form');
        const requestType = $('input[name="request-type"]:checked').val();
    
        const visibleFieldsSelector = requestType === 'service-unit'
            ? '#allocation-fields input[required]:visible, #allocation-fields select[required]:visible'
            : '#storage-fields input[required]:visible, #storage-fields select[required]:visible';
    
        const requiredFields = $form.find(visibleFieldsSelector);
        const isFormValid = requiredFields.toArray().every(field => validateField($(field)));
    
        $('#submit').prop('disabled', !isFormValid); // Disable button if form is invalid
    }
    
    // Initialization Function
    async function initialize() {
        console.log("Initializing form...");
    
        try {
            // Hide sections initially to avoid flickering
            $('#allocation-fields, #storage-fields, #common-fields, #billing-information').hide();
    
            // Display a loading spinner during metadata and user data fetch
            const loadingMessage = $('<div>')
                .addClass('alert alert-info d-flex align-items-center')
                .attr('id', 'loading-message')
                .html(`
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Initializing the form. Please wait...
                `)
                .prependTo('#combined-request-form');
    
            // Set a timeout for metadata loading
            const metadataTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Metadata loading timed out.')), 15000)
            );
    
            // Attempt to fetch metadata with a timeout
            apiMetadata = await Promise.race([fetchMetadata(), metadataTimeout]);
    
            if (!apiMetadata) {
                throw new Error("Metadata fetch failed.");
            }
    
            console.log("Metadata successfully fetched:", apiMetadata);
    
            // Update form elements using fetched metadata
            updateFormUsingMetadata(apiMetadata);
    
            // Fetch user groups and populate dropdowns
            await fetchAndPopulateGroups();
    
            // Set up event handlers for dynamic interactivity
            setupEventHandlers();
    
            // Set up real-time payload preview
            setupPayloadPreviewUpdater();
    
            // Initialize visibility of fields based on initial state
            toggleRequestFields();
            updateFormValidation();
    
            console.log("Form initialization complete.");
        } catch (error) {
            console.error("Error during form initialization:", error);
    
            // Display a user-friendly error message
            showErrorMessage(
                "Failed to load user information. Please refresh the page or contact support if the issue persists."
            );
        } finally {
            // Ensure the loading spinner is removed
            $('#loading-message').remove();
        }
    }

    $(document).ready(function () {
        console.log("Script started");
        console.log("Updated Combined Request Form JS loaded");
    
        // ===================================
        // Start Initiation
        // ===================================
        initialize();
    });