import fetch from "node-fetch";

const TRANSIFEX_TOKEN = process.env.TTOKEN ?? "?";
const TRANSIFEX_URL = "https://rest.api.transifex.com";

export async function transifexGetAll(url: string, query: any): Promise<any[]> {
  const queryString = new URLSearchParams(query).toString();
  if (queryString.length > 0) url += `?${queryString}`;
  url = `${TRANSIFEX_URL}${url}`;

  const actualData = [];
  while (true) {
    const data = await transfiexGetRaw(url);
    actualData.push(...data.data);

    if (data.links.next) {
      url = data.links.next;
      continue;
    }
    break;
  }
  return actualData;
}

export async function transifexGet(url: string, query: any): Promise<any> {
  const queryString = new URLSearchParams(query).toString();
  if (queryString.length > 0) url += `?${queryString}`;
  return await transfiexGetRaw(`${TRANSIFEX_URL}${url}`);
}

export async function transfiexGetRaw(url: string): Promise<any> {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TRANSIFEX_TOKEN}`,
    },
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (ex) {
    console.warn(ex);
    return text;
  }
}

export async function transifexPost(url: string, body: any): Promise<any> {
  const resp = await fetch(`${TRANSIFEX_URL}${url}`, {
    headers: {
      Authorization: `Bearer ${TRANSIFEX_TOKEN}`,
      "Content-Type": "application/vnd.api+json",
    },
    method: "post",
    body: JSON.stringify(body),
  });
  return await resp.json();
}
