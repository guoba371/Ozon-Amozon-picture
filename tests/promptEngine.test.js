const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  buildImageSet,
  buildBatchGenerationPlan,
  buildPromptStyleReview,
  buildEditPrompt,
  getPlatformSpec,
} = require("../src/promptEngine");

const PRODUCT =
  "一款便携式电动咖啡机，黑银配色，流线型设计，适合户外露营和居家使用。";

describe("platform specifications", () => {
  it("hard-codes Amazon main image requirements from the document", () => {
    const spec = getPlatformSpec("amazon");

    assert.equal(spec.aspectRatio, "1:1");
    assert.equal(spec.mainBackground, "RGB 255, 255, 255");
    assert.match(spec.mainPromptPrefix, /严格纯白背景/i);
    assert.match(spec.mainPromptPrefix, /85%/);
    assert.match(spec.mainPromptPrefix, /无文字/i);
  });

  it("hard-codes Ozon image requirements from the document", () => {
    const spec = getPlatformSpec("ozon");

    assert.equal(spec.aspectRatio, "4:5");
    assert.equal(spec.mainBackground, "#f2f2f2 兼容浅灰背景");
    assert.match(spec.mainPromptPrefix, /干净浅灰背景/i);
  });
});

describe("full image set generation", () => {
  it("creates a seven-image Amazon set with a strict compliant hero prompt", () => {
    const set = buildImageSet({ platform: "amazon", description: PRODUCT });

    assert.equal(set.platform, "amazon");
    assert.equal(set.images.length, 7);
    assert.equal(set.images[0].id, "hero-main");
    assert.match(set.images[0].prompt, /严格纯白背景/i);
    assert.match(set.images[0].prompt, /RGB 255, 255, 255/i);
    assert.match(set.images[0].prompt, /画面占比至少 85%/i);
    assert.doesNotMatch(set.images[0].prompt, /浅灰背景/i);
  });

  it("creates a six-image Ozon set with 4:5 light-gray compatible prompts", () => {
    const set = buildImageSet({ platform: "ozon", description: PRODUCT });

    assert.equal(set.platform, "ozon");
    assert.equal(set.images.length, 6);
    assert.match(set.images[0].prompt, /干净浅灰背景/i);
    assert.match(set.images[0].prompt, /4:5 aspect ratio/i);
    assert.match(set.images[2].prompt, /尺寸标注线/i);
    assert.match(set.images[3].prompt, /户外露营场景/i);
  });

  it("uses editable placeholders for infographic label areas", () => {
    const set = buildImageSet({ platform: "amazon", description: PRODUCT });
    const feature = set.images.find((image) => image.id === "feature-infographic");
    const size = set.images.find((image) => image.id === "size-spec");

    assert.match(feature.prompt, /可编辑占位文字/i);
    assert.match(size.prompt, /占位尺寸/i);
  });

  it("returns Chinese image titles and descriptions for the UI", () => {
    const set = buildImageSet({ platform: "amazon", description: PRODUCT });

    assert.equal(set.images[0].title, "极致主图");
    assert.equal(set.images[0].role, "通过审核并提升点击率");
    assert.equal(set.images[1].title, "核心卖点详情图");
    assert.equal(set.images[3].title, "户外场景生活图");
    assert.equal(set.images[6].title, "包装与信任背书图");
  });

  it("uses editable platform overrides in generated prompts and metadata", () => {
    const set = buildImageSet({
      platform: "ozon",
      description: PRODUCT,
      specOverrides: {
        aspectRatio: "3:4",
        mainBackground: "暖白色背景 #faf8f2",
        recommendedResolution: "建议 1500 x 2000 像素",
        exportFormat: "PNG",
        imageCount: 8,
        mainPromptPrefix: "暖白色背景 #faf8f2，自定义 Ozon 主图规范",
        basePrompt: "Ozon 自定义电商图，暖白棚拍，高级柔光",
      },
    });

    assert.equal(set.spec.aspectRatio, "3:4");
    assert.equal(set.spec.imageCount, 8);
    assert.match(set.images[0].prompt, /暖白色背景 #faf8f2/);
    assert.match(set.images[1].prompt, /Ozon 自定义电商图/);
  });

  it("builds a one-click batch generation plan with the uploaded original image", () => {
    const plan = buildBatchGenerationPlan({
      platform: "amazon",
      description: PRODUCT,
      originalImageName: "coffee-maker-main.png",
    });

    assert.equal(plan.images.length, 7);
    assert.equal(plan.originalImageName, "coffee-maker-main.png");
    assert.equal(plan.images[0].status, "ready");
    assert.match(plan.images[0].generationPrompt, /一次性生成图组/);
    assert.match(plan.images[0].generationPrompt, /原始商品参考图：coffee-maker-main\.png/);
    assert.match(plan.images[0].generationPrompt, /极致主图/);
  });

  it("builds a reviewable prompt style set before upload", () => {
    const review = buildPromptStyleReview({
      platform: "ozon",
      description: "黑银色便携咖啡机，露营和家里都能用，外观高级。",
    });

    assert.equal(review.stage, "review");
    assert.equal(review.uploadAllowed, false);
    assert.equal(review.images.length, 6);
    assert.match(review.summary, /请先确认提示词样式/);
    assert.match(review.images[0].prompt, /黑银色便携咖啡机/);
  });
});

describe("single image edit prompt generation", () => {
  it("preserves composition and product identity while applying an edit intent", () => {
    const prompt = buildEditPrompt({
      platform: "ozon",
      description: PRODUCT,
      imageId: "lifestyle-outdoor",
      modificationIntent:
        "把女性模特换成男性模特，并让场景看起来更冷一些。",
    });

    assert.match(prompt, /保持产品身份一致/i);
    assert.match(prompt, /相同构图/i);
    assert.match(prompt, /Image_lifestyle-outdoor_Ref/i);
    assert.match(prompt, /男性模特/i);
    assert.match(prompt, /更冷/i);
  });

  it("creates exact text replacement instructions for dimension labels", () => {
    const prompt = buildEditPrompt({
      platform: "amazon",
      description: PRODUCT,
      imageId: "size-spec",
      modificationIntent: "更新文字为：高度 25cm，宽度 10cm。",
    });

    assert.match(prompt, /逐字更新数字标签/i);
    assert.match(prompt, /高度 25cm，宽度 10cm/i);
    assert.match(prompt, /保留尺寸标注线/i);
  });

  it("includes the uploaded original product image as a concrete reference", () => {
    const prompt = buildEditPrompt({
      platform: "amazon",
      description: PRODUCT,
      imageId: "hero-main",
      originalImageName: "coffee-maker-white-bg.png",
      modificationIntent: "让银色部分更有抛光质感。",
    });

    assert.match(prompt, /原始商品参考图：coffee-maker-white-bg\.png/i);
    assert.match(prompt, /使用这张上传的原始商品图/i);
  });
});
