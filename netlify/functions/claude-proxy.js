exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, {
        error: "На сервере не найден ANTHROPIC_API_KEY.",
      });
    }

    const body = JSON.parse(event.body || "{}");
    const imageBase64 = body.imageBase64;
    const imageMimeType = body.imageMimeType;

    if (!imageBase64 || !imageMimeType) {
      return jsonResponse(400, {
        error: "Не передано изображение.",
        debug: {
          hasImageBase64: Boolean(imageBase64),
          hasImageMimeType: Boolean(imageMimeType),
          bodyKeys: Object.keys(body || {})
        }
      });
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ]);

    if (!allowedTypes.has(imageMimeType)) {
      return jsonResponse(400, {
        error: "Неподдерживаемый формат изображения.",
      });
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 120,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageMimeType,
                  data: imageBase64
                }
              },
              {
                type: "text",
                text:
                  "Определи товар на фото. Ответь только одной строкой без пояснений: бренд, модель, ключевая характеристика для поиска. Максимум 8 слов."
              }
            ]
          }
        ]
      })
    });

    const data = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      return jsonResponse(anthropicResponse.status, {
        error:
          data?.error?.message ||
          data?.error?.type ||
          "Ошибка API Anthropic.",
        raw: data
      });
    }

    const productName =
      data?.content
        ?.filter((item) => item.type === "text")
        ?.map((item) => item.text)
        ?.join(" ")
        ?.trim() || "";

    if (!productName) {
      return jsonResponse(502, {
        error: "Claude не вернул название товара.",
        raw: data
      });
    }

    return jsonResponse(200, { productName });
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "Внутренняя ошибка сервера.",
    });
  }
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload),
  };
}
