import { Response } from 'express';
import { Wardrobe } from '../models/Wardrobe';

export const getWardrobe = async (req: any, res: Response) => {
  try {
    const items = await Wardrobe.find({ uid: req.user.userId });
    const formatted = items.map(item => ({
      id: item._id.toString(),
      name: item.name,
      color: item.color,
      type: item.type,
      formality: item.formality,
      uid: item.uid.toString()
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wardrobe' });
  }
};

export const addItem = async (req: any, res: Response) => {
  try {
    const newItem = new Wardrobe({ ...req.body, uid: req.user.userId });
    await newItem.save();
    res.json({ id: newItem._id.toString(), ...req.body, uid: req.user.userId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add item' });
  }
};

export const removeItem = async (req: any, res: Response) => {
  try {
    await Wardrobe.findOneAndDelete({ _id: req.params.id, uid: req.user.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
