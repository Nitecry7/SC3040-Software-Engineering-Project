// Use the already-installed matching SDK for Node tests; production keeps its Deno npm import.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'npm:@supabase/supabase-js@2.114.0') {
    return nextResolve(new URL('../FrontEnd/node_modules/@supabase/supabase-js/dist/index.mjs', import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
}
