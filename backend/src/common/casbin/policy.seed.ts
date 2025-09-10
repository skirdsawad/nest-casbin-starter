export const POLICY_CSV = `
p, AF,   *,   requests, view
p, AF,   *,   requests, create
p, AF,   *,   requests, edit

p, CG,   *,   requests, view
p, CG,   *,   requests, bulk_approve
p, CG,   *,   requests, approve:DEPT_HEAD
p, CG,   *,   requests, approve:AMD_REVIEW

# D15 has HD approval at DEPT_HEAD
p, HD,  D15,  requests, view
p, HD,  D15,  requests, create
p, HD,  D15,  requests, edit
p, HD,  D15,  requests, approve:DEPT_HEAD

# AMD can approve fallback stage globally
p, AMD,   *,  requests, approve:AMD_REVIEW
`;

export const GROUPING_CSV = `
# Two heads in D15
g, user_hd_a, HD,  D15
g, user_hd_b, HD,  D15

# No HD in D19 (fallback to AMD)

# AMD global
g, user_amd_1, AMD, *

# AF, CG global
g, user_af_1, AF, *
g, user_cg_1, CG, *
`;
