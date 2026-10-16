import type { CardDef } from '@sanctum/engine';
import caravan from './caravan';
import cleansingLight from './cleansingLight';
import flight from './flight';
import healingHands from './healingHands';
import oasis from './oasis';
import pyx from './pyx';
import wellspring from './wellspring';

export const lifeCards: CardDef[] = [caravan, flight, cleansingLight, pyx, healingHands, oasis, wellspring];
