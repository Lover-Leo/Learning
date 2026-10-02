#include<iostream>
#include<string>
#include<vector>
#include<windows.h>
class Student //定义一个studnet类
{
    private:
        std::string name;
        int id;
        float score;
    public:
        Student(const std::string& newname, int newid, float newscore);
        const std::string& getName() const;
        int getId() const;
        float getScore() const;
        bool setscore(float newscore);
        void showInfo() const;
};
Student::Student(const std::string& newname,int newid,float newscore):
name(newname),id(newid),score(newscore)
{
    //构造函数
}

int Student::getId() const
{
    return id;
}
float Student::getScore() const
{
    return score;
}
bool Student::setscore(float newscore)
{
    if(newscore < 0 || newscore > 100)
    {
        return false;
    }
    score = newscore; 
    return true;
}
void Student::showInfo() const
{
    std::cout << name;
    std::cout << id;
    std::cout << score;
}
void addStudent(std::vector<Student>& students)
{
    std::string newname;
    int newid;
    float newscore;
    std::cout << "name:";
    std::cin >> newname;
    std::cout << "id:";
    std::cin >> newid;
    std::cout << "score:";
    std::cin >> newscore;
    students.emplace_back(newname,newid,newscore);
}
void 
