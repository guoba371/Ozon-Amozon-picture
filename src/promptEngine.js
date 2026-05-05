"use strict";

const PLATFORM_SPECS = {
  amazon: {
    id: "amazon",
    label: "Amazon",
    aspectRatio: "1:1",
    recommendedResolution: "建议 1600 x 1600 像素或更高",
    exportFormat: "优先 JPEG，支持 PNG",
    mainBackground: "RGB 255, 255, 255",
    imageCount: 7,
    mainPromptPrefix:
      "严格纯白背景，RGB 255, 255, 255，符合 Amazon 主图规范，产品画面占比至少 85%，无文字、无 Logo、无水印、无边框、无不属于产品本身的道具",
    basePrompt:
      "Amazon 平台电商图，干净商业摄影风格，高分辨率，细节清晰",
  },
  ozon: {
    id: "ozon",
    label: "Ozon",
    aspectRatio: "4:5",
    recommendedResolution: "建议 1200 x 1500 像素",
    exportFormat: "JPG, JPEG, or PNG",
    mainBackground: "#f2f2f2 兼容浅灰背景",
    imageCount: 6,
    mainPromptPrefix:
      "干净浅灰背景，兼容 #f2f2f2，Ozon 平台主图，纯净棚拍构图，无文字、无水印、无价格、无联系方式",
    basePrompt:
      "Ozon 平台电商图，明亮干净的商业摄影风格，4:5 aspect ratio，高质量",
  },
};

const IMAGE_TEMPLATES = [
  {
    id: "hero-main",
    title: "极致主图",
    role: "通过审核并提升点击率",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) => {
      const amazonDetails =
        "专业棚拍，居中构图，完整展示产品全貌，无阴影，超高分辨率，细节锐利，商业级布光";
      const ozonDetails =
        "专业棚拍，轻微斜角展示立体深度，高质量，商业级布光，构图干净，4:5 aspect ratio";
      return [
        spec.mainPromptPrefix,
        `主体：${description}`,
        spec.id === "amazon" ? amazonDetails : ozonDetails,
      ].join("。");
    },
  },
  {
    id: "feature-infographic",
    title: "核心卖点详情图",
    role: "突出痛点与解决方案",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，干净商业背景`,
        `主体：${description} 的局部特写`,
        "重点展示控制面板和电源按钮",
        "添加简洁高级的功能指示线和数字标签，使用可编辑占位文字，例如“一键萃取”“LED 指示灯”",
        "高科技质感，干净线性图标，焦点清晰，中文标签清楚易读",
      ].join("。"),
  },
  {
    id: "size-spec",
    title: "尺寸对比与规格图",
    role: "管理预期并降低退货",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，中性棚拍背景`,
        `主体：${description}，旁边放置手机或手部作为尺寸参照`,
        "图形：添加尺寸标注线，展示高度和宽度，使用占位尺寸，例如“20cm”“8cm”",
        "字体清晰易读，信息图风格，比例对比明确",
      ].join("。"),
  },
  {
    id: "lifestyle-outdoor",
    title: "户外场景生活图",
    role: "营造户外使用欲望",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，自然户外背景`,
        `主体：模特在户外露营场景中使用 ${description}`,
        "模特坐在帐篷附近，于日出时把咖啡倒入杯中",
        "温暖自然光，轻微镜头光晕，浅景深，画面焦点集中在产品上",
      ].join("。"),
  },
  {
    id: "lifestyle-interior",
    title: "居家办公生活图",
    role: "呈现家庭与办公使用场景",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，室内背景`,
        `主体：${description} 放在现代干净的厨房台面或专业办公桌上`,
        "旁边摆放一杯刚做好的咖啡",
        "窗边柔和晨光，极简装饰，营造舒适高效的氛围",
      ].join("。"),
  },
  {
    id: "texture-quality",
    title: "材质质感细节图",
    role: "建立信任与高级感",
    platforms: ["amazon", "ozon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，带有动态阴影的棚拍背景`,
        `主体：${description} 的极近距离特写`,
        "重点展示黑色拉丝金属质感，以及银色与黑色交界处的结构细节",
        "突出高级做工，微距摄影，景深控制，精致布光",
      ].join("。"),
  },
  {
    id: "packaging-trust",
    title: "包装与信任背书图",
    role: "展示包装、认证或信任信号",
    platforms: ["amazon"],
    buildPrompt: ({ spec, description }) =>
      [
        `${spec.basePrompt}，干净棚拍背景`,
        `主体：${description} 与精致零售包装一同展示`,
        "可加入克制的认证占位标识，例如 CE、FCC，仅在适用时使用",
        "不添加虚假卖点，版式高级，营造信任感的商业摄影",
      ].join("。"),
  },
];

function normalizePlatform(platform) {
  const key = String(platform || "").trim().toLowerCase();
  if (!PLATFORM_SPECS[key]) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return key;
}

function getPlatformSpec(platform) {
  return { ...PLATFORM_SPECS[normalizePlatform(platform)] };
}

function mergeSpec(platform, specOverrides = {}) {
  const baseSpec = getPlatformSpec(platform);
  return {
    ...baseSpec,
    ...Object.fromEntries(
      Object.entries(specOverrides || {}).filter(([, value]) => {
        if (typeof value === "string") return value.trim() !== "";
        return value !== undefined && value !== null;
      }),
    ),
    id: baseSpec.id,
    label: baseSpec.label,
  };
}

function buildImageSet({ platform, description, specOverrides }) {
  const spec = mergeSpec(platform, specOverrides);
  const cleanDescription = String(description || "").trim();
  if (!cleanDescription) {
    throw new Error("Product description is required");
  }

  const images = IMAGE_TEMPLATES.filter((template) =>
    template.platforms.includes(spec.id),
  ).map((template, index) => ({
    id: template.id,
    number: index + 1,
    title: template.title,
    role: template.role,
    prompt: template.buildPrompt({ spec, description: cleanDescription }),
  }));

  return {
    platform: spec.id,
    platformLabel: spec.label,
    spec,
    images,
  };
}

function buildBatchGenerationPlan({
  platform,
  description,
  originalImageName,
  specOverrides,
}) {
  const cleanOriginalImageName = String(originalImageName || "").trim();
  const set = buildImageSet({ platform, description, specOverrides });
  return {
    ...set,
    originalImageName: cleanOriginalImageName,
    images: set.images.map((image) => ({
      ...image,
      status: "ready",
      generatedImageUrl: "",
      generationPrompt: [
        `一次性生成图组中的第 ${image.number} 张：${image.title}`,
        `原始商品参考图：${cleanOriginalImageName || "已上传的原始商品图"}`,
        "使用原始商品图作为 Image-to-Image 参考，保持产品外形、比例、材质和配色一致",
        `平台：${set.platformLabel}`,
        `图片目标：${image.role}`,
        `生成提示词：${image.prompt}`,
      ].join("。"),
      editIntent: "",
      editPrompt: "",
    })),
  };
}

function buildPromptStyleReview({ platform, description, specOverrides }) {
  const set = buildImageSet({ platform, description, specOverrides });
  return {
    ...set,
    stage: "review",
    uploadAllowed: false,
    summary: "请先确认提示词样式。确认不再变动后，才允许上传原始商品图并正式开始生图。",
  };
}

function buildEditPrompt({
  platform,
  description,
  imageId,
  originalImageName,
  modificationIntent,
  specOverrides,
}) {
  const spec = mergeSpec(platform, specOverrides);
  const cleanDescription = String(description || "").trim();
  const cleanImageId = String(imageId || "").trim();
  const cleanOriginalImageName = String(originalImageName || "").trim();
  const cleanIntent = String(modificationIntent || "").trim();
  if (!cleanDescription || !cleanImageId || !cleanIntent) {
    throw new Error("Description, imageId, and modificationIntent are required");
  }

  const base = [
    `平台：${spec.label}`,
    `基础约束：${spec.mainPromptPrefix}`,
    `主体：${cleanDescription}`,
    "保持产品身份一致，精确保留轮廓、材质、黑银配色关系、比例和平台安全的商业质感",
    cleanOriginalImageName
      ? `原始商品参考图：${cleanOriginalImageName}`
      : "原始商品参考图：已上传的原始商品图",
    `使用这张上传的原始商品图和当前 Image_${cleanImageId}_Ref 作为参考图`,
    `除非修改意图明确要求改变布局，否则保持与 Image_${cleanImageId}_Ref 相同构图`,
    `修改意图：${cleanIntent}`,
  ];

  if (/height|width|尺寸|text|文字|label|cm|厘米/i.test(cleanIntent)) {
    base.push(
      "图形：保留尺寸标注线和比例参照物位置",
      `文字：逐字更新数字标签，使其符合这条指令：“${cleanIntent}”`,
      "字体清晰易读，不添加额外宣传语，保留中性棚拍版式",
    );
  }

  if (/male|female|model|colder|cold|frost|mist|模特|冷/i.test(cleanIntent)) {
    base.push(
      "生活场景编辑时，产品必须保持画面焦点，只修改用户要求的模特、天气、温度氛围和色彩倾向",
      "使用真实可控的光线，避免产品外形漂移",
    );
  }

  return base.join("。");
}

const api = {
  buildImageSet,
  buildBatchGenerationPlan,
  buildPromptStyleReview,
  buildEditPrompt,
  getPlatformSpec,
  mergeSpec,
  PLATFORM_SPECS,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof window !== "undefined") {
  window.PromptEngine = api;
}
