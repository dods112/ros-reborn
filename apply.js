const APPLY_ENDPOINT = 'https://ros-reborn.onrender.com/api/apply';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('apply-form');
  const submitBtn = document.getElementById('submit-btn');
  const formStatus = document.getElementById('form-status');
  const fileInput = document.getElementById('proof');
  const platformSelect = document.getElementById('platform');
  const otherWrap = document.getElementById('other-wrap');

  if (platformSelect && otherWrap) {
    platformSelect.addEventListener('change', function () {
      otherWrap.hidden = platformSelect.value !== 'other';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.reportValidity()) return;

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      formStatus.textContent = "";
      formStatus.className = "form-status";

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      console.log("SUBMITTED FORM DATA:", data);

      const file = fileInput.files[0];
      if (file) {
        if (file.size > 3 * 1024 * 1024) { 
          formStatus.textContent = "File is too large. Please upload a file smaller than 3MB.";
          formStatus.className = "form-status is-error";
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          return;
        }

        const base64File = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
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
          const resultData = await response.json();
          form.reset();
          
          formStatus.innerHTML = `
            <strong>Application submitted successfully!</strong><br><br>
            Your Reference ID is: <strong style="font-size: 18px; color: #211b78;">${resultData.refId}</strong><br>
            <span style="font-size: 14px;">Keep this ID safe. You can check your application status <a href="status.html" style="color: var(--accent-pink); text-decoration: underline;">here</a>.</span>
          `;
          formStatus.className = "form-status is-success";
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Server error: ${response.status}`);
        }
      } catch (error) {
        console.error('Submission error:', error);
        formStatus.textContent = `Error: ${error.message}`;
        formStatus.className = "form-status is-error";
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    });
  }
});