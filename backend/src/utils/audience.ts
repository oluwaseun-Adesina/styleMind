/**
 * Returns true only if the OAuth token's audience was minted for one of our
 * own client IDs. Pure function so the audience check is unit-testable.
 */
export const isAllowedAudience = (
  audience: string | undefined,
  allowed: readonly string[]
): boolean => {
  return Boolean(audience) && allowed.includes(audience as string);
};
