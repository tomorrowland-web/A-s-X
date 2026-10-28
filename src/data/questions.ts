export interface Question {
  id: string;
  text: string;
  options: string[];
  answer: number;
  hint: string;
  category: 'riddle' | 'logic' | 'memory' | 'observation';
}

/** All answers are zero-based indices. Content is local and never calls an API. */
export const QUESTIONS: Question[] = [
  { id: 'q01', text: 'What grows larger the more you take away?', options: ['A shadow', 'A hole', 'A fire', 'A memory'], answer: 1, hint: 'Think of a shovel removing earth.', category: 'riddle' },
  { id: 'q02', text: 'I have keys but no locks, space but no room. What am I?', options: ['A prison', 'A keyboard', 'A staircase', 'A coffin'], answer: 1, hint: 'You could type your answer on one.', category: 'riddle' },
  { id: 'q03', text: 'What can you break without ever touching it?', options: ['A promise', 'A candle', 'A mirror', 'A chain'], answer: 0, hint: 'It is something you give with your word.', category: 'riddle' },
  { id: 'q04', text: 'The more there is of me, the less you see. What am I?', options: ['Light', 'Glass', 'Darkness', 'Distance'], answer: 2, hint: 'Your flashlight keeps it away.', category: 'riddle' },
  { id: 'q05', text: 'I speak without a mouth and answer only after you. What am I?', options: ['An echo', 'A clock', 'A photograph', 'A flame'], answer: 0, hint: 'Shout into a deep empty well.', category: 'riddle' },
  { id: 'q06', text: 'What belongs to you, but other people say it more often than you do?', options: ['Your age', 'Your name', 'Your address', 'Your dream'], answer: 1, hint: 'It is written on a patient wristband.', category: 'riddle' },
  { id: 'q07', text: 'You restored the ward identities. Which patient belongs in Room 2?', options: ['Ada', 'Mia', 'Leo', 'Elias'], answer: 2, hint: 'Leo’s record says his room lies between Ada and Mia.', category: 'memory' },
  { id: 'q08', text: 'Three lamps are lit. The middle lamp fails. How many lamps are still lit?', options: ['One', 'Two', 'Three', 'None'], answer: 1, hint: 'Subtract one working lamp from three.', category: 'observation' },
  { id: 'q09', text: 'A nurse walks north, then east, then south, each for the same distance. Where is she relative to where she began?', options: ['West', 'North', 'East', 'At the start'], answer: 2, hint: 'The north and south movements cancel.', category: 'logic' },
  { id: 'q10', text: 'I follow you in light but abandon you in complete darkness. What am I?', options: ['Your shadow', 'Your breath', 'Your heartbeat', 'Your name'], answer: 0, hint: 'Light blocked by your body creates it.', category: 'riddle' },
  { id: 'q11', text: 'A mirror reverses the written sequence MOON — EYE — SUN. What sequence should its reflection show?', options: ['MOON — SUN — EYE', 'SUN — EYE — MOON', 'EYE — MOON — SUN', 'SUN — MOON — EYE'], answer: 1, hint: 'Read the original sequence from right to left.', category: 'memory' },
  { id: 'q12', text: 'On a wall: a red circle, a blue square, a white triangle. Which shape was blue?', options: ['Circle', 'Triangle', 'Square', 'None'], answer: 2, hint: 'The middle symbol has four equal sides.', category: 'observation' },
  { id: 'q13', text: 'The wall showed SUN, EYE, MOON. Which symbol appeared first in the reflected sequence?', options: ['Sun', 'Eye', 'A star', 'Moon'], answer: 3, hint: 'The mirror altar reads the wall from right to left.', category: 'memory' },
  { id: 'q14', text: 'Recall the true path through the three doors. Which door came second?', options: ['Door 4', 'Door 1', 'Door 2', 'Door 3'], answer: 1, hint: 'The warning said: SECOND door, FIRST door, FOURTH door.', category: 'memory' },
  { id: 'q15', text: 'What gets wetter as it dries something else?', options: ['A flame', 'A towel', 'A stone', 'A window'], answer: 1, hint: 'It absorbs water from your hands.', category: 'riddle' },
  { id: 'q16', text: 'What has a face and two hands, but no arms or legs?', options: ['A clock', 'A portrait', 'A doll', 'A mirror'], answer: 0, hint: 'Its hands tell the time.', category: 'riddle' },
  { id: 'q17', text: 'Five candles burn. You extinguish two. How many candles are still burning immediately afterward?', options: ['Two', 'Three', 'Five', 'None'], answer: 1, hint: 'Count the flames, not the wax bodies.', category: 'logic' },
  { id: 'q18', text: 'An inscription says: ASH before BONE, BONE before BLOOD. Which must be placed last?', options: ['Ash', 'Bone', 'Blood', 'Any of them'], answer: 2, hint: 'Follow the two ordering rules.', category: 'logic' },
  { id: 'q19', text: 'I am always ahead of you, yet you can never see me. What am I?', options: ['The future', 'The floor', 'The past', 'A candle'], answer: 0, hint: 'Tomorrow is part of it.', category: 'riddle' },
  { id: 'q20', text: 'What can fill a room without taking up physical space?', options: ['Water', 'Smoke', 'Light', 'Sand'], answer: 2, hint: 'Switch on a lamp.', category: 'riddle' },
  { id: 'q21', text: 'Recall the vigil. You lit candle 2, then candle 4. Which candle came next?', options: ['Candle 2', 'Candle 4', 'Candle 3', 'Candle 1'], answer: 3, hint: 'The litany said SECOND, FOURTH, FIRST, THIRD.', category: 'observation' },
  { id: 'q22', text: 'What has many teeth but cannot bite?', options: ['A comb', 'A wolf', 'A skull', 'A trap'], answer: 0, hint: 'It passes through your hair.', category: 'riddle' },
  { id: 'q23', text: 'A sealed clock reads 11. Exactly three hours pass. What hour does it now show on a twelve-hour face?', options: ['12', '1', '2', '3'], answer: 2, hint: 'Count 12, then 1, then 2.', category: 'logic' },
  { id: 'q24', text: 'The keeper wrote: I lit the WEST candle first, EAST second, NORTH last. Which direction came second?', options: ['North', 'South', 'East', 'West'], answer: 2, hint: 'It is opposite west.', category: 'memory' },
  { id: 'q25', text: 'What has a neck but no head?', options: ['A bottle', 'A mask', 'A statue', 'A coat hook'], answer: 0, hint: 'A cork can close it.', category: 'riddle' },
  { id: 'q26', text: 'A flame needs fuel, heat, and oxygen. Which action directly removes its oxygen supply?', options: ['Adding wax', 'Covering it with an airtight lid', 'Holding it higher', 'Warming the room'], answer: 1, hint: 'Prevent fresh air from reaching the flame.', category: 'logic' },
  { id: 'q27', text: 'The keeper’s journal revealed the man behind the wax. Who was the keeper of these lamps?', options: ['Mara', 'Elias', 'Ada', 'Clara'], answer: 1, hint: 'His journal begins: I was ELIAS, keeper of these lamps.', category: 'memory' },
  { id: 'q28', text: 'Two doors: one marked EXIT, one marked RETURN. A note says the labels are both wrong. Which door leads out?', options: ['EXIT', 'RETURN', 'Both', 'Neither'], answer: 1, hint: 'The door labeled RETURN cannot lead back.', category: 'logic' },
  { id: 'q29', text: 'What disappears as soon as you say its name aloud?', options: ['Silence', 'Darkness', 'A shadow', 'A memory'], answer: 0, hint: 'Speaking creates sound.', category: 'riddle' },
  { id: 'q30', text: 'The memorial reads: ONE keeper, FOUR lost children, FIVE names remembered. How many children were lost?', options: ['One', 'Three', 'Four', 'Five'], answer: 2, hint: 'Distinguish the keeper from the children.', category: 'observation' },
];
