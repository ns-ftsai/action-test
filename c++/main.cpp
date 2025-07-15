#include <iostream>
#include <string>
#include <vector>

// A simple class to represent a person.
class Person {
public:
    // Constructor
    Person(std::string name, int age) : name_(name), age_(age) {}

    // A method to greet.
    void greet() const {
        std::cout << "Hello, my name is " << name_ << " and I am " << age_ << " years old." << std::endl;
    }

private:
    std::string name_;
    int age_;
};

int main() {
    // Create an instance of the Person class.
    Person developer("Alex", 30);

    // Call the greet method on the instance.
    developer.greet(); // Let's try to find the definition of 'greet'

    return 0;
}
