import groovy.transform.CompileStatic

// Type your code here, or load an example.
@CompileStatic
class Square {
    static int square(int num) {
        num * num
    }

    static void main(String[] args) {
        println square(5)
    }
}