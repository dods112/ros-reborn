// apply.js

// 1. Set the endpoint to your Netlify function
const APPLY_ENDPOINT = '/.netlify/functions/apply';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('apply-form');
  const submitBtn = document.getElementById('submit-btn');
  const formStatus = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Optional: Add your validation logic here before submitting

      // UI Loading State
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      formStatus.textContent = "";
      formStatus.className = "form-status"; // Reset classes

      // Gather form data
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        // Send to Netlify Function
        const response = await fetch(APPLY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          // Success!
          form.reset();
          formStatus.textContent = "Application submitted successfully! We will review it soon.";
          formStatus.classList.add('is-success');
        } else {
          // Server error
          throw new Error('Server returned an error');
        }
      } catch (error) {
        console.error('Submission error:', error);
        formStatus.textContent = "Oops! Something went wrong. Please try again later.";
        formStatus.classList.add('is-error');
      } finally {
        // Remove loading state
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    });
  }
});