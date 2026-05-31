/* api.js — Sentinel Core Frontend API Service Layer */

const API = (() => {
  const BASE_URL = 'http://localhost:8000/api/v1';

  async function _handleResponse(response) {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        body?.error?.detail ||
        body?.detail ||
        `HTTP ${response.status} ${response.statusText}`;
      throw new Error(detail);
    }
    return body;
  }

  async function checkHealth() {
    const res = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    return _handleResponse(res);
  }

  async function uploadFile(file, templateOverride = null) {
    const formData = new FormData();
    formData.append('file', file);
    const url = templateOverride
      ? `${BASE_URL}/imports/upload?template_override=${templateOverride}`
      : `${BASE_URL}/imports/upload`;
    const res = await fetch(url, { method: 'POST', body: formData });
    return _handleResponse(res);
  }

  async function uploadBatch(fileList) {
    const formData = new FormData();
    Array.from(fileList).forEach(f => formData.append('files', f));
    const res = await fetch(`${BASE_URL}/imports/upload/batch`, {
      method: 'POST',
      body: formData,
    });
    return _handleResponse(res);
  }

  async function getSubscribers() {
    const res = await fetch(`${BASE_URL}/subscribers`, { method: 'GET' });
    return _handleResponse(res);
  }

  async function getCdrCalls(subscriberId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(
      `${BASE_URL}/analytics/${subscriberId}/calls${qs ? '?' + qs : ''}`,
      { method: 'GET' }
    );
    return _handleResponse(res);
  }

  async function getLocation(subscriberId) {
    const res = await fetch(`${BASE_URL}/analytics/${subscriberId}/map`, {
      method: 'GET',
    });
    return _handleResponse(res);
  }

  return { checkHealth, uploadFile, uploadBatch, getSubscribers, getCdrCalls, getLocation };
})();
