(function () {
  const {
    buildImageSet,
    buildBatchGenerationPlan,
    buildPromptStyleReview,
    buildEditPrompt,
    getPlatformSpec,
  } = window.PromptEngine;

  const form = document.querySelector("#prompt-form");
  const descriptionInput = document.querySelector("#description");
  const platformBanner = document.querySelector("#platform-banner");
  const reviewPrompts = document.querySelector("#review-prompts");
  const confirmPrompts = document.querySelector("#confirm-prompts");
  const uploadStep = document.querySelector("#upload-step");
  const generateImages = document.querySelector("#generate-images");
  const specAspectRatio = document.querySelector("#spec-aspect-ratio");
  const specBackground = document.querySelector("#spec-background");
  const specResolution = document.querySelector("#spec-resolution");
  const specFormat = document.querySelector("#spec-format");
  const specCount = document.querySelector("#spec-count");
  const specMainPrefix = document.querySelector("#spec-main-prefix");
  const specBasePrompt = document.querySelector("#spec-base-prompt");
  const resetSpec = document.querySelector("#reset-spec");
  const listNode = document.querySelector("#prompt-list");
  const setTitle = document.querySelector("#set-title");
  const setSummary = document.querySelector("#set-summary");
  const referenceStrip = document.querySelector("#reference-strip");
  const editImage = document.querySelector("#edit-image");
  const editIntent = document.querySelector("#edit-intent");
  const editOutput = document.querySelector("#edit-output");
  const originalImageInput = document.querySelector("#original-image");
  const uploadName = document.querySelector("#upload-name");
  const imagePreview = document.querySelector("#image-preview");
  const previewImg = document.querySelector("#preview-img");
  const previewTitle = document.querySelector("#preview-title");
  const previewDetail = document.querySelector("#preview-detail");
  const clearImage = document.querySelector("#clear-image");
  const copyAll = document.querySelector("#copy-all");
  const copyEdit = document.querySelector("#copy-edit");
  const buildEdit = document.querySelector("#build-edit");
  const downloadJson = document.querySelector("#download-json");
  const themeToggle = document.querySelector("#theme-toggle");
  const themeLabel = themeToggle?.querySelector(".theme-label");

  let currentSet = null;
  let promptReview = null;
  let batchPlan = null;
  let promptsConfirmed = false;
  let originalImageName = "";
  let originalImageDataUrl = "";
  let previewUrl = "";
  let activePlatform = "";

  const THEME_STORAGE_KEY = "image-studio-theme";

  function preferredTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalizedTheme;
    if (themeToggle) {
      const isDark = normalizedTheme === "dark";
      themeToggle.setAttribute("aria-pressed", String(isDark));
      themeToggle.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
    }
    if (themeLabel) {
      themeLabel.textContent = normalizedTheme === "dark" ? "浅色" : "深色";
    }
  }

  function selectedPlatform() {
    return new FormData(form).get("platform");
  }

  function specInputs() {
    return [
      specAspectRatio,
      specBackground,
      specResolution,
      specFormat,
      specCount,
      specMainPrefix,
      specBasePrompt,
    ];
  }

  function currentSpecOverrides() {
    return {
      aspectRatio: specAspectRatio.value.trim(),
      mainBackground: specBackground.value.trim(),
      recommendedResolution: specResolution.value.trim(),
      exportFormat: specFormat.value.trim(),
      imageCount: Number(specCount.value) || getPlatformSpec(selectedPlatform()).imageCount,
      mainPromptPrefix: specMainPrefix.value.trim(),
      basePrompt: specBasePrompt.value.trim(),
    };
  }

  function loadDefaultSpec(platform) {
    const spec = getPlatformSpec(platform);
    specAspectRatio.value = spec.aspectRatio;
    specBackground.value = spec.mainBackground;
    specResolution.value = spec.recommendedResolution;
    specFormat.value = spec.exportFormat;
    specCount.value = spec.imageCount;
    specMainPrefix.value = spec.mainPromptPrefix;
    specBasePrompt.value = spec.basePrompt;
  }

  function renderSpec(spec) {
    platformBanner.innerHTML =
      spec.id === "amazon"
        ? `<strong>Amazon 主图硬约束</strong><span>纯白 RGB 255,255,255 · 产品占图 85%+ · 无文字/水印/边框</span>`
        : `<strong>Ozon 图组方向</strong><span>默认 4:5 竖图 · 白色或浅灰 #f2f2f2 · 可按商品类目调整</span>`;
  }

  function renderReferenceStrip(message) {
    if (message) {
      referenceStrip.innerHTML = message;
      return;
    }
    if (!currentSet) return;
    const source = originalImageName
      ? `原始商品图：${originalImageName}`
      : "尚未上传原始商品图";
    const guidance = promptsConfirmed
      ? "提示词已确认，可以正式生图。"
      : "可以先上传原始商品图；正式生图前仍需确认提示词样式。";
    referenceStrip.innerHTML = `
      <span class="${originalImageName ? "ref-dot ready" : "ref-dot"}"></span>
      <strong>${source}</strong>
      <span>${guidance}</span>
    `;
  }

  function renderPromptCards(set) {
    listNode.innerHTML = set.images
      .map(
        (image) => `
          <article class="prompt-card" data-id="${image.id}">
            <header>
              <span class="image-number">${image.number}</span>
              <div>
                <h3>${image.title}</h3>
                <p>${image.role}</p>
              </div>
              <button type="button" class="copy-one" aria-label="复制 ${image.title} 提示词">复制</button>
            </header>
            <textarea class="prompt-text" readonly>${image.prompt}</textarea>
          </article>
        `,
      )
      .join("");
  }

  function renderPromptReview(review) {
    setTitle.textContent = `${review.platformLabel} 提示词样式确认`;
    setSummary.textContent = `${review.images.length} 张图 · 待确认`;
    renderReferenceStrip(`
      <span class="ref-dot"></span>
      <strong>提示词样式待确认</strong>
      <span>${review.summary}</span>
    `);
    renderPromptCards(review);
  }

  function renderPreviewSet(set) {
    setTitle.textContent = `${set.platformLabel} 提示词预览`;
    setSummary.textContent = `${set.images.length} 张图 · ${set.spec.aspectRatio}`;
    renderPromptCards(set);
    renderReferenceStrip();
  }

  function renderBatchPlan(plan) {
    setTitle.textContent = `${plan.platformLabel} 图组生成`;
    setSummary.textContent = `${plan.images.length} 张图 · ${plan.spec.aspectRatio}`;
    listNode.innerHTML = plan.images
      .map(
        (image) => `
          <article class="prompt-card generation-card" data-id="${image.id}">
            <header>
              <span class="image-number">${image.number}</span>
              <div>
                <h3>${image.title}</h3>
                <p>${image.role}</p>
              </div>
              <button type="button" class="copy-one" data-action="copy-generation" aria-label="复制 ${image.title} 生成提示词">复制</button>
            </header>
            <div class="generated-preview">
              <div class="generated-placeholder" data-preview>
                <strong>${image.title}</strong>
                <span>等待 Image-2-Gen 生成</span>
              </div>
            </div>
            <textarea class="prompt-text generation-prompt" readonly>${image.generationPrompt}</textarea>
            <div class="card-edit">
              <label>
                <span>本图修改意图</span>
                <textarea class="card-edit-intent" rows="3" placeholder="例如：把背景改成更冷的清晨露营场景，保留产品位置"></textarea>
              </label>
              <div class="card-actions">
                <button type="button" class="primary-action" data-action="regenerate-card">重新生成本张</button>
                <button type="button" class="secondary-action" data-action="download-image" disabled>下载图片</button>
                <button type="button" class="secondary-action" data-action="build-card-edit">生成本图编辑提示词</button>
                <button type="button" class="ghost-action" data-action="copy-card-edit">复制编辑提示词</button>
              </div>
              <textarea class="prompt-output card-edit-output" rows="5" readonly></textarea>
            </div>
          </article>
        `,
      )
      .join("");
    renderReferenceStrip();
  }

  function resetConfirmation() {
    promptsConfirmed = false;
    batchPlan = null;
    confirmPrompts.disabled = !promptReview;
    confirmPrompts.textContent = "确认不再变动";
    originalImageInput.disabled = false;
    generateImages.disabled = !(promptsConfirmed && originalImageName);
    renderReferenceStrip();
  }

  function refreshPreviewSet() {
    const platform = selectedPlatform();
    if (platform !== activePlatform) {
      activePlatform = platform;
      loadDefaultSpec(platform);
    }
    currentSet = buildImageSet({
      platform,
      description: descriptionInput.value,
      specOverrides: currentSpecOverrides(),
    });
    renderSpec(currentSet.spec);
    renderPreviewSet(currentSet);
    updateEditSelect(currentSet);
    buildEditPromptOutput();
  }

  function reviewPromptStyles() {
    const platform = selectedPlatform();
    if (platform !== activePlatform) {
      activePlatform = platform;
      loadDefaultSpec(platform);
    }
    promptReview = buildPromptStyleReview({
      platform,
      description: descriptionInput.value,
      specOverrides: currentSpecOverrides(),
    });
    currentSet = promptReview;
    batchPlan = null;
    renderSpec(promptReview.spec);
    renderPromptReview(promptReview);
    updateEditSelect(promptReview);
    confirmPrompts.disabled = false;
    showToast("请检查提示词样式，确认后即可正式生图");
  }

  function confirmPromptStyles() {
    if (!promptReview) {
      showToast("请先生成提示词样式");
      return;
    }
    promptsConfirmed = true;
    confirmPrompts.textContent = "已确认";
    confirmPrompts.disabled = true;
    originalImageInput.disabled = false;
    generateImages.disabled = !originalImageName;
    renderReferenceStrip();
    showToast(originalImageName ? "提示词已确认，可以正式生图" : "提示词已确认，请上传原始商品图");
  }

  function updateEditSelect(set) {
    editImage.innerHTML = set.images
      .map((image) => `<option value="${image.id}">${image.number}. ${image.title}</option>`)
      .join("");
  }

  async function requestImageGeneration(prompt, action = "auto") {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        referenceImageDataUrl: originalImageDataUrl,
        action,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "图片生成失败");
    return payload;
  }

  function setCardGenerating(card, label) {
    const preview = card.querySelector("[data-preview]");
    preview.className = "generated-placeholder generating";
    preview.innerHTML = `<strong>${label}</strong><span>正在生成图片...</span>`;
  }

  function setCardImage(card, imageDataUrl, title) {
    const preview = card.querySelector("[data-preview]");
    preview.className = "generated-result";
    preview.innerHTML = `<img src="${imageDataUrl}" alt="${title} 生成结果">`;
    const downloadButton = card.querySelector('[data-action="download-image"]');
    downloadButton.disabled = false;
    downloadButton.dataset.imageUrl = imageDataUrl;
  }

  function setCardError(card, message) {
    const preview = card.querySelector("[data-preview]");
    preview.className = "generated-placeholder error-state";
    preview.innerHTML = `<strong>生成失败</strong><span>${message}</span>`;
  }

  async function generateBatchPlan() {
    if (!promptsConfirmed) {
      showToast("请先确认提示词样式不再变动");
      return;
    }
    if (!originalImageName) {
      showToast("请先上传原始商品图");
      originalImageInput.focus();
      return;
    }

    batchPlan = buildBatchGenerationPlan({
      platform: selectedPlatform(),
      description: descriptionInput.value,
      originalImageName,
      specOverrides: currentSpecOverrides(),
    });
    currentSet = batchPlan;
    renderSpec(batchPlan.spec);
    renderBatchPlan(batchPlan);
    updateEditSelect(batchPlan);
    buildEditPromptOutput();
    showToast(`开始生成 ${batchPlan.images.length} 张图`);

    const cards = Array.from(listNode.querySelectorAll(".generation-card"));
    for (const [index, card] of cards.entries()) {
      const image = batchPlan.images[index];
      setCardGenerating(card, image.title);
      try {
        const result = await requestImageGeneration(image.generationPrompt, "generate");
        image.generatedImageUrl = result.imageDataUrl;
        setCardImage(card, result.imageDataUrl, image.title);
      } catch (error) {
        setCardError(card, error.message);
      }
    }
    showToast("整组图片生成流程已完成");
  }

  function buildEditPromptOutput() {
    if (!currentSet) return;
    editOutput.value = buildEditPrompt({
      platform: currentSet.platform,
      description: descriptionInput.value,
      imageId: editImage.value,
      originalImageName,
      modificationIntent: editIntent.value,
      specOverrides: currentSpecOverrides(),
    });
  }

  function setOriginalImage(file) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }

    if (!file) {
      originalImageName = "";
      originalImageDataUrl = "";
      uploadName.textContent = "用于 Image-to-Image 参考，建议白底清晰主图";
      imagePreview.hidden = true;
      previewImg.removeAttribute("src");
      previewImg.alt = "";
      previewTitle.textContent = "原始商品图";
      previewDetail.textContent = "已作为产品形态参考";
      generateImages.disabled = true;
      renderReferenceStrip();
      buildEditPromptOutput();
      return;
    }

    originalImageName = file.name;
    uploadName.textContent = file.name;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      originalImageDataUrl = reader.result;
    });
    reader.readAsDataURL(file);
    previewUrl = URL.createObjectURL(file);
    previewImg.src = previewUrl;
    previewImg.alt = `${file.name} 预览`;
    previewTitle.textContent = file.name;
    previewDetail.textContent = "已上传，将用于 Image-to-Image 参考";
    imagePreview.hidden = false;
    generateImages.disabled = !promptsConfirmed;
    renderReferenceStrip();
    buildEditPromptOutput();
  }

  async function copyText(text, message) {
    await navigator.clipboard.writeText(text);
    showToast(message);
  }

  function allPromptText() {
    const set = batchPlan || currentSet;
    if (!set) return "";
    return set.images
      .map((image) => `No.${image.number} ${image.title}\n${image.generationPrompt || image.prompt}`)
      .join("\n\n---\n\n");
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 1800);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    generateBatchPlan();
  });

  form.addEventListener("change", (event) => {
    if (event.target === originalImageInput) return;
    if (event.target.name === "platform") {
      promptReview = null;
      refreshPreviewSet();
    }
    resetConfirmation();
  });
  descriptionInput.addEventListener("input", resetConfirmation);
  specInputs().forEach((input) => input.addEventListener("input", resetConfirmation));
  resetSpec.addEventListener("click", () => {
    loadDefaultSpec(selectedPlatform());
    resetConfirmation();
  });
  reviewPrompts.addEventListener("click", reviewPromptStyles);
  confirmPrompts.addEventListener("click", confirmPromptStyles);
  editImage.addEventListener("change", buildEditPromptOutput);
  editIntent.addEventListener("input", buildEditPromptOutput);
  buildEdit.addEventListener("click", buildEditPromptOutput);
  originalImageInput.addEventListener("change", () => {
    setOriginalImage(originalImageInput.files[0]);
  });
  clearImage.addEventListener("click", () => {
    originalImageInput.value = "";
    setOriginalImage(null);
  });

  listNode.addEventListener("click", (event) => {
    const button = event.target.closest(".copy-one");
    const actionButton = event.target.closest("[data-action]");
    if (button) {
      const text = button.closest(".prompt-card").querySelector(".prompt-text").value;
      copyText(text, "已复制单张提示词");
      return;
    }
    if (!actionButton) return;

    const card = actionButton.closest(".prompt-card");
    const imageId = card.dataset.id;
    const intentInput = card.querySelector(".card-edit-intent");
    const output = card.querySelector(".card-edit-output");
    const action = actionButton.dataset.action;

    if (action === "download-image") {
      const imageUrl = actionButton.dataset.imageUrl;
      if (!imageUrl) {
        showToast("图片生成成功后才能下载");
        return;
      }
      const title = card.querySelector("h3").textContent.trim();
      const number = card.querySelector(".image-number").textContent.trim();
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${currentSet.platform}-${number}-${title}.png`;
      link.click();
      showToast("已开始下载图片");
      return;
    }

    if (action === "build-card-edit") {
      if (!intentInput.value.trim()) {
        showToast("请先填写本图修改意图");
        intentInput.focus();
        return;
      }
      output.value = buildEditPrompt({
        platform: currentSet.platform,
        description: descriptionInput.value,
        imageId,
        originalImageName,
        modificationIntent: intentInput.value,
        specOverrides: currentSpecOverrides(),
      });
      showToast("已生成本图编辑提示词");
      return;
    }

    if (action === "regenerate-card") {
      const prompt = output.value.trim() || card.querySelector(".generation-prompt").value;
      setCardGenerating(card, "重新生成本张");
      requestImageGeneration(prompt, output.value.trim() ? "edit" : "generate")
        .then((result) => {
          setCardImage(card, result.imageDataUrl, card.querySelector("h3").textContent);
          showToast("本张图片已重新生成");
        })
        .catch((error) => setCardError(card, error.message));
      return;
    }

    if (action === "copy-card-edit") {
      if (!output.value.trim()) {
        showToast("请先生成本图编辑提示词");
        return;
      }
      copyText(output.value, "已复制本图编辑提示词");
    }
  });

  copyAll.addEventListener("click", () => copyText(allPromptText(), "已复制全部提示词"));
  copyEdit.addEventListener("click", () => copyText(editOutput.value, "已复制编辑提示词"));
  themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  });

  downloadJson.addEventListener("click", () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      productDescription: descriptionInput.value,
      originalImageName,
      ...currentSet,
      editPrompt: editOutput.value,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentSet.platform}-image-prompts.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  applyTheme(preferredTheme());
  loadDefaultSpec(selectedPlatform());
  originalImageInput.disabled = false;
  refreshPreviewSet();
  resetConfirmation();
})();
