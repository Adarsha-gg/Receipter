export async function fakeScoutFetch(url: string | URL | Request): Promise<Response> {
  const text = String(url);
  if (text.includes('hn.algolia.com')) {
    return jsonResponse({
      hits: [
        {
          title: 'Useful agent opportunity',
          url: 'https://example.com/opportunity',
          points: 10,
          created_at: '2026-06-18T20:00:00.000Z',
        },
      ],
    });
  }

  return jsonResponse({
    items: [
      {
        full_name: 'example/agent-tool',
        html_url: 'https://github.com/example/agent-tool',
        description: 'A public repo related to the task.',
        stargazers_count: 5,
        updated_at: '2026-06-18T20:00:00.000Z',
      },
    ],
  });
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
