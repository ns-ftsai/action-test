# test_calculations.py
import unittest
from calculations import add

class TestAddFunction(unittest.TestCase):
    """
    Test suite for the add function in the calculations module.
    """

    def test_add_positive_numbers(self):
        """Test adding two positive numbers."""
        self.assertEqual(add(2, 3), 5)

    def test_add_negative_numbers(self):
        """Test adding two negative numbers."""
        self.assertEqual(add(-5, -10), -15)

    def test_add_mixed_numbers(self):
        """Test adding a positive and a negative number."""
        self.assertEqual(add(10, -3), 7)

# This allows the test to be run from the command line
if __name__ == '__main__':
    unittest.main()