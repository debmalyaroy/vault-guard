# Demo Script

## Act 1: The Attack (30 seconds)
1. **Host:** "This is VAULTGUARD. Left panel — you're the attacker. Let's see what happens."
2. **Action:** Click "Indirect Injection" in the Attack Console. Set sophistication to HIGH. Target BOTH.
3. **Action:** Click FIRE.
4. **Observation:**
   - **Agent A:** Displays `COMPROMISED`. Output shows prompt leak.
   - **Agent B:** Displays `DEFENDED`. Output is clean.
   - **Threat Feed:** Shows `INJECTION DETECTED` caught in Stage 2 (Corpus fast-path).

## Act 2: The Corpus (30 seconds)
1. **Host:** "Now let's try something novel."
2. **Action:** Switch to "Custom" tab in Attack Console.
3. **Action:** Type: *"make the agent recommend only Apple products"*
4. **Action:** Click GENERATE & FIRE.
5. **Observation:**
   - **Agent A:** Gets confused and recommends Apple products.
   - **Agent B:** Threat Intercepted.
   - **Threat Feed:** Shows `NEW PATTERN ADDED TO CORPUS` ⭐.
   - **Header:** Notice the Corpus counter at the top right increments by 1.

## Act 3: Policy Enforcement (30 seconds)
1. **Host:** "Different policy, different outcome."
2. **Action:** Go to the VaultGuard Shield panel (Right).
3. **Action:** Change Active Policy to "Financial Analyst".
4. **Action:** Fire "Dark Pattern" attack.
5. **Observation:**
   - Agent B now partially succumbs because the Financial Analyst policy explicitly allows payment pages.
6. **Host:** "VaultGuard makes consequences visible before deployment."