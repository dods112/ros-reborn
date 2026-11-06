const APPLY_ENDPOINT = '/.netlify/functions/apply';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('apply-form');
  const submitBtn = document.getElementById('submit-btn');
  const formStatus = document.getElementById('form-status');
  const fileInput = document.getElementById('proof');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // UI Loading State
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      formStatus.textContent = "";
      formStatus.className = "form-status";

      // Gather standard form data
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Handle the file upload
            // Handle the file upload
      const file = fileInput.files[0];
      if (file) {
        // Check if file is larger than 2MB (Netlify limit is 6MB total, Base64 adds 33% overhead)
        if (file.size > 2 * 1024 * 1024) { 
          formStatus.textContent = "File is too large. Please upload a file smaller than 2MB.";
          formStatus.classList.add('is-error');
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          return;
        }

        // Convert file to Base64
        const base64File = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data URL prefix
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        data.proof_file = base64File;
        data.proof_name = file.name;
      }

      try {
        const response = await fetch(APPLY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          form.reset();
          formStatus.textContent = "Application submitted successfully! We will review it soon.";
          formStatus.classList.add('is-success');
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Server error: ${response.status}`);
        }
      } catch (error) {
        console.error('Submission error:', error);
        formStatus.textContent = `Error: ${error.message}`;
        formStatus.classList.add('is-error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    });
  }
});